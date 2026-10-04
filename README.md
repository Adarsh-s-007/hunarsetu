# HunarSetu · Bridge of Skills

Family-first AI counselling for vocational career pathways. This is the SIH 2026 prototype for problem statement **SIH26241** (Smart Education), from team Bloch ’n roll_A0 (ID 177014).

Learners and parents talk to HunarSetu together, in Telugu, Hindi or English. Every worry is answered with figures from a verified outcome database, and each figure shows where it came from.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173. One command runs the website, the API and the database. **No keys are needed:** the AI counsellor uses a free service out of the box.

**Production (one process):**

```bash
npm run build
npm start
```

This serves the site and the API on port 8080 (`PORT` changes it). It needs Node 22.13 or later, because the database uses Node's built-in `node:sqlite`.

## Free services it uses

| What | Service | Key needed? |
|---|---|---|
| AI counsellor | [Pollinations](https://pollinations.ai) text API (open model) | **No** |
| Faster, more reliable AI (optional) | [Groq](https://console.groq.com/keys) or [Google Gemini](https://aistudio.google.com/apikey) | Free key |
| District and mandal from a PIN code | [India Post PIN API](https://api.postalpincode.in) | No |
| Coordinates for a place | [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org) | No |
| Real ITIs and polytechnics nearby | [OpenStreetMap Overpass](https://overpass-api.de) | No |
| Maps | OpenStreetMap tiles | No |
| Voice input and read-aloud | The browser's built-in speech | No |

The server caches these answers in its database and spaces out requests, as the services' fair-use rules ask.

**Which AI answers:**

1. Claude, if `ANTHROPIC_API_KEY` is set (optional, paid).
2. Groq or Gemini, if a free key is set.
3. Otherwise Pollinations, which needs no key.

If every service fails, the browser falls back to the built-in offline engine, so the chat never breaks. The chat header shows which one is answering.

**Language:** every answer comes in the language the person just wrote in, not only the site's language. Telugu script gets Telugu, Devanagari gets Hindi, English gets English, and romanised Hindi or Telugu ("meri beti ko naukri milegi?") gets the same back. The server checks the AI's reply and asks again if the language is wrong; the offline engine follows the same rule. Read-aloud picks its voice from the text.

**Speed:** the keyless Pollinations tier allows about one answer every 15–30 seconds per server. The server queues the questions and retries while the tier is busy, and the chat shows "The free AI is busy. Still trying…". After about a minute, the offline engine answers instead. A free key removes the wait: [Groq](https://console.groq.com/keys) is fastest, and [Gemini](https://aistudio.google.com/apikey) writes the best Hindi and Telugu (it is used first for those languages when its key is set). Put the key in `.env` (copy `.env.example`) and restart.

## How the AI stays honest

The AI never invents numbers:

1. **Look up facts.** For each question, the server looks up the facts it needs in the outcome database: pay, jobs, safety, fees, career steps, family stories.
2. **One model call.** It sends those facts to the model in a single call. Claude instead calls the same lookups itself as tools.
3. **Check every figure.** The **"No Source, No Number"** check compares every figure in the reply with those facts and the family's own words. Anything that doesn't match is replaced with "[—]" before the family sees it.

The same rules hand a family over to a real person when someone is in distress, a worry keeps coming back, or the topic is sensitive. Sensitive topics are marriage or a daughter's safety, and a woman counsellor is offered.

## Pages

| Page | Route |
|---|---|
| Home, with the chat. The **–** button makes it a small "Ask HunarSetu" button. | `/` |
| Ask a question: family setup with an optional PIN code, a 3-picture "How to use" strip, the chat (with a "Read answers aloud" switch), and "Who is worried about what" below it | `/counsel` |
| Courses & pay, and each course with centre cards, steps to grow and real nearby places | `/trades`, `/trades/:id` |
| Your path, step by step, in plain words | `/path` |
| Compare choices over 5 or 10 years | `/simulator` |
| Family plan, printable | `/pact` |
| How we check the numbers: every centre, what it claimed, what past students said, and the label families see | `/numbers` |
| Talk to a person: "What happens next" steps, call-back request, and request-status check (`?ticket=HS-…` fills it in) | `/counsellor` |
| Admin (password needed): 7 sections (where, why, calls to make, getting better?, what works, live families, number checks) | `/admin` |

**Admin dashboard:** open it with the **Admin** button in the top bar (or `/admin`). It always needs the password set as `ADMIN_PASSWORD` in `.env`; put the value in quotes if it contains `#`. Without a password the dashboard stays locked. The page shows nothing before sign-in, and the server sends live data (the call list, phone numbers and live families) only to a signed-in admin. The example map and chart figures are part of the site's code. A sign-in lasts 12 hours, and **Sign out** is at the top of the dashboard.

**Hand-over to a person:** when the chat hands a family over, the family can type a phone number right in the chat. That joins the chat's own request, so there is one request per family. Counsellors change its status (Waiting, Called, Resolved), and the family sees it under the chat or by checking its request number.

**Made for low literacy:** talk instead of type, a "Read answers aloud" switch, a 3-picture guide above the chat, picture buttons for worries, a bigger-text button, and short everyday words in all three languages.

## API

| Route | Purpose |
|---|---|
| `GET /api/health` | Which AI is answering, outcome stats, whether the dashboard is protected |
| `GET /api/outcomes` · `GET /api/outcomes/:id/provenance` | Published outcome records, and the raw claim, tracer result and rule behind one record |
| `POST /api/counsel` | One family turn (Claude, then the free AI, else `503 {fallback:true}`) |
| `GET /api/location/pin/:pin` | District, mandal and coordinates for a PIN code |
| `GET /api/places/training?district=&lat=&lon=` | Real ITIs and polytechnics from OpenStreetMap, with distances |
| `POST /api/sessions` | Anonymised engagement and stance signals |
| `GET /api/analytics/live` | Aggregates of those signals (admin) |
| `POST /api/escalations` | New call-back request |
| `GET /api/escalations/:id/status` | Status of one request, for the family |
| `GET /api/escalations` · `PATCH /api/escalations/:id` | Counsellor queue and status updates (admin) |
| `POST /api/admin/login` · `POST /api/admin/logout` · `GET /api/admin/me` | Dashboard sign-in |

The API also limits how fast each visitor can send requests, and validates everything it receives.

## Data and privacy

- **Real data:**
  - PIN-code areas, real training places and map distances, from the free public services above
  - The statistics on the home page (PLFS 2023-24, ASER 2023, NITI Aayog 2023)
- **Illustrative sample data:** outcome figures per centre (pay, jobs, tracer calls) and the dashboard's baseline, both generated deterministically. The site says so on every data page. In production they would come from SIDH, DGT-ITI MIS, NCS and real tracer calls.
- **What's stored:**
  - Sessions keep anonymised signals only: no names, phone numbers or message text.
  - Call-back requests keep the phone number only until the request is marked Resolved; after that only the last 4 digits are kept. Only signed-in officials can see it.
- **What leaves the server:** family messages are sent to whichever AI service is answering. Free tiers may log requests. For a real deployment, use a provider with a data agreement, or set `HUNARSETU_FREE_AI=off` to stop using the keyless service.

## Deploy for free

### Vercel

The repo is ready for Vercel: `vercel.json` builds the site with Vite and runs the whole API as one Vercel Function (`api/index.js`), with up to 60 seconds per request so slow free-AI answers can finish.

1. On vercel.com, choose **Add New → Project** and import this GitHub repo. Keep the detected settings (`vercel.json` sets them).
2. Under **Environment Variables**, add `ADMIN_PASSWORD` with your password. Type it **without quotes**; quotes are only needed inside a `.env` file. Optionally add a free `GEMINI_API_KEY` or `GROQ_API_KEY` for faster answers.
3. **Keep call requests and live families (recommended):** in the project, open **Storage → Create / Connect → Upstash for Redis** (free plan) and connect it to the project. Vercel adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you. You can also paste `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from an Upstash account yourself.
4. Deploy (or **Redeploy** after adding storage or variables).

Without step 3 the site still works, but Vercel only keeps files for a short time: call requests and the dashboard's live families can disappear, and the dashboard says so. The course and pay data is rebuilt automatically on every start either way.

### Render (or any always-on Node server)

1. Build command: `npm install && npm run build`
2. Start command: `npm start`
3. Add `ADMIN_PASSWORD` (and a free AI key if you have one) as environment variables.

Data is saved in `server/.data`. On free plans that disk is reset on redeploys and restarts; connect Upstash Redis (the same two variables as above) to keep call requests and live families.

## Credits

- Hero videos: [Pexels](https://www.pexels.com), streamed from the Pexels CDN.
- Photos: [Unsplash](https://unsplash.com).
- Maps and places: © OpenStreetMap contributors.
- Icons: [Lucide](https://lucide.dev).
- Fonts: Baloo 2, Baloo Tammudu 2, Hind and Hind Guntur (Google Fonts).
- AI: Pollinations, Groq, Google Gemini, Anthropic Claude.
