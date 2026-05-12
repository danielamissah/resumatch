# Changelog

All notable changes to ResuMatch are documented here.

---

## [v1.0.0] — 2026-05-12

**First public release.**

ResuMatch is live at [resumatch-dka.vercel.app](https://resumatch-dka.vercel.app/).

### Core Features

**Resume Analysis**

* Upload resume as PDF, DOCX, or plain text
* Paste job description or scrape directly from a URL (Lever, Greenhouse, LinkedIn, generic pages)
* RAG pipeline embeds the job description into ChromaDB using `sentence-transformers all-MiniLM-L6-v2` (local, free)
* Top-k relevant JD chunks retrieved per resume section via cosine similarity
* Three Groq Llama 3.3 70B analysis chains run sequentially (rate-limit safe):
  * **Match Scorer** — section-by-section fit score 0–100 with matched and missing keywords
  * **Gap Analyser** — missing skills ranked by priority (critical / important / nice-to-have) with frequency, role-specific context, actionable suggestions, and a YouTube learning link per skill
  * **Bullet Rewriter** — side-by-side original vs rewritten bullets using RAG-retrieved JD keywords, with accept / reject / copy per bullet

**ATS Keyword Density Meter**

* Pure frontend calculation, no API call, instant result
* Strips ~60 noise words, deduplicates JD keywords, checks resume for each via substring match
* Score thresholds: 70%+ strong · 45–69% moderate · below 45% weak
* Top missing keywords listed with visual progress bar

**Redline Word Export**

* Download `.docx` with original bullets in red strikethrough and rewrites in green underline
* Visually identical to Word track changes review mode
* Skill gaps appendix with YouTube links included in the document

**Cover Letter Generator**

* Accessible as a tab on the results page (pre-filled from analysis) and as a standalone page at `/cover-letter`
* Three tone options: Formal · Conversational · Confident
* Generates two versions simultaneously:
  * Version A — leads with impact and achievements
  * Version B — leads with motivation and role fit
* Personal details: name, email, phone, LinkedIn, location
* Download either version as a clean `.docx` with candidate header and teal divider
* Copy to clipboard button per version

**Character Counters**

* Live `used / limit` counter with progress bar on resume and JD text inputs
* Colour shifts teal → amber → red as limit approaches
* Groq free tier guidance shown below each counter

### Infrastructure

**CI/CD — GitHub Actions**

* Backend tests (41) run on every push to `master` and `develop`
* Frontend TypeScript type check on every push
* Docker images built and pushed to Docker Hub on every push to `master`
* Railway (backend) and Vercel (frontend) auto-deploy via GitHub integration

**Docker**

* Multi-stage Dockerfile for backend — builder + runtime stages
* CPU-only PyTorch (`torch==2.2.0+cpu`) — reduces image size significantly
* `numpy==1.26.4` pinned explicitly for sentence-transformers compatibility
* `ARG CI=true` skips model baking during CI builds
* Persistent volumes for ChromaDB and model cache
* `docker compose up` brings up full stack locally

**Deployment**

* Backend: Railway (Hobby plan) with persistent `/app/chroma_db` volume
* Frontend: Vercel (free tier)
* Images: Docker Hub (`danielamissah/resumatch:latest`, `danielamissah/resumatch-frontend:latest`)

### Tests — 41 passing

| Suite                    | Tests        |
| ------------------------ | ------------ |
| `TestResumeParser`     | 7            |
| `TestSectionDetection` | 3            |
| `TestJobScraper`       | 8            |
| `TestEmbeddings`       | 6            |
| `TestSchemas`          | 3            |
| `TestAnalyzeEndpoint`  | 7            |
| `TestExport`           | 2            |
| `TestAtsDensity`       | 5            |
| **Total**          | **41** |

### Known Limitations

* Analysis takes 30–45 seconds on Groq free tier due to sequential chain execution and 3-second buffers between calls
* Job URL scraping works for Lever and Greenhouse; LinkedIn blocks server-side requests — paste JD directly as workaround
* Cover letter and analysis results stored in memory — lost on server restart (Supabase persistence planned for v1.1.0)
* Docker image is ~800MB compressed due to PyTorch dependency

### API Endpoints

| Method   | Endpoint                          | Description                        |
| -------- | --------------------------------- | ---------------------------------- |
| `POST` | `/analyze/text`                 | Analyse plain text resume + JD     |
| `POST` | `/analyze/file`                 | Analyse uploaded PDF or DOCX + JD  |
| `GET`  | `/analyze/{id}`                 | Retrieve saved analysis            |
| `POST` | `/scrape`                       | Scrape job description from URL    |
| `GET`  | `/export/{id}/docx`             | Download redline Word document     |
| `POST` | `/cover-letter/generate`        | Generate two cover letter versions |
| `GET`  | `/cover-letter/{id}`            | Retrieve saved cover letter        |
| `GET`  | `/cover-letter/{id}/export/{v}` | Download cover letter as Word      |
| `GET`  | `/health`                       | Health check                       |
| `GET`  | `/docs`                         | Interactive API documentation      |

---

## Roadmap

### v1.1.0 — Persistence

* Supabase integration — save and retrieve analyses across sessions
* Auth via email magic link (Clerk)
* Analysis history dashboard

### v1.2.0 — More AI features

* Interview question predictor — based on JD and skill gaps
* LinkedIn headline suggester
* Salary range estimator from JD

### v2.0.0 — Scale

* Kubernetes deployment manifests
* Upgrade to OpenAI GPT-4o when revenue covers API costs
* Multi-language support (German, French)
