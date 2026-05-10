# ResuMatch

> **RAG-powered resume tailoring — score your fit, identify skill gaps, and get bullet rewrites tailored to any specific job.**

🔗 **Live:** [resumatch-dka.vercel.app](https://resumatch-dka.vercel.app/)
🐳 **Docker:** `docker pull danielamissah/resumatch:latest`
📄 **API Docs:** [resumatch.up.railway.app/docs](https://resumatch.up.railway.app/docs)
⭐ **GitHub:** [github.com/danielamissah/resumatch](https://github.com/danielamissah/resumatch)

---

## The problem

Most resume tools paste your resume into a GPT prompt and return generic rewrites that could apply to any job. They don't know what the specific role actually requires, which keywords the ATS will scan for, or how your experience maps to the job description.

ResuMatch is different. It uses Retrieval Augmented Generation (RAG) to retrieve the most relevant parts of the job description for each section of your resume before analysis. The output is role-specific, not generic.

---

## Features

* **Resume upload** — PDF, DOCX, or paste as plain text
* **Job input** — scrape from URL (Lever, Greenhouse, LinkedIn, generic) or paste directly
* **Fit Score** — section-by-section match score 0–100 with plain English explanations, matched and missing keywords per section
* **ATS Keyword Density** — percentage of JD keywords present in your resume, top missing keywords, scoring thresholds (70%+ strong · 45–69% moderate · below 45% weak)
* **Skill Gap Analysis** — missing skills ranked by priority (critical / important / nice-to-have), frequency in JD, role-specific context, actionable suggestions, and a **YouTube learning link per skill**
* **Bullet Rewriter** — side-by-side original vs rewritten bullets using RAG-retrieved JD keywords, with accept / reject / copy per bullet
* **Redline Word Export** — download `.docx` with original bullets in red strikethrough and rewrites in green underline — visually identical to Word track changes
* **Character counters** — live limits show token budget remaining (Groq free tier safe)
* **Zero cost** — Groq free tier + local sentence-transformers embeddings

---

## How it works

```
User uploads resume + job URL or text
              │
              ▼
      FastAPI Backend
              │
    ┌─────────┴──────────┐
    │                    │
Resume Parser        Job Scraper
(PDF/DOCX/text)      (Lever, Greenhouse,
PyMuPDF, docx        LinkedIn, generic)
    │                    │
    └─────────┬──────────┘
              │
   ChromaDB + sentence-transformers
   JD chunked into overlapping 200-word pieces
   Embedded locally with all-MiniLM-L6-v2
   Stored in persistent ChromaDB collection
              │
   RAG Retrieval
   Top-k most relevant JD chunks per
   resume section via cosine similarity
              │
    ┌─────────┼──────────┐
    │         │          │
 Scorer    Gap        Rewriter
 Chain   Analyser     Chain
    │         │          │
    └─────────┴──────────┘
              │
   Groq — Llama 3.3 70B
   JSON-mode structured output
   Sequential execution (rate-limit safe)
              │
   AnalysisResult JSON
              │
   Next.js 15 Frontend
   ┌─────────┼──────────┐
   │         │          │
 Score     Gaps      Bullets
  Tab       Tab        Tab
                        │
                 Download .docx
```

### ATS Keyword Density — how it is calculated

Pure frontend calculation, no API call, instant result:

1. Split the JD into individual words
2. Remove ~60 noise words (`the`, `and`, `with`, `your`, `experience`, `strong`, etc.)
3. Filter to words longer than 3 characters and deduplicate
4. Check which unique JD keywords appear anywhere in the resume text (case-insensitive substring match)
5. Density = matched ÷ total × 100

**Thresholds:** 70%+ = strong ATS signal · 45–69% = moderate · below 45% = weak

This is a heuristic, not a true ATS simulation. Different systems (Workday, Greenhouse, Taleo) use different algorithms. The density meter is a useful signal, not a guarantee.

---

## Tech stack

| Layer              | Technology                                 | Why                                                 |
| ------------------ | ------------------------------------------ | --------------------------------------------------- |
| Frontend           | Next.js 15, TypeScript                     | App router, Vercel-native, standalone Docker output |
| Styling            | Pure inline styles                         | No Tailwind compile step, works anywhere            |
| Backend            | FastAPI, Python 3.11                       | Async, typed, clean OpenAPI docs                    |
| LLM                | Groq — Llama 3.3 70B                      | Free tier, fast inference, JSON mode                |
| Embeddings         | sentence-transformers `all-MiniLM-L6-v2` | Local, free, ~90MB, downloads once                  |
| Vector store       | ChromaDB                                   | Persistent on disk, no external service needed      |
| Resume parsing     | PyMuPDF, python-docx                       | PDF + DOCX text extraction                          |
| Job scraping       | httpx, BeautifulSoup4                      | Platform-specific + generic extractors              |
| Word export        | python-docx                                | Redline document generation                         |
| Tests              | pytest, 41 tests                           | Parser, scraper, embeddings, schemas, API, export   |
| CI/CD              | GitHub Actions                             | Tests on every push, Docker + deploy on tags        |
| Frontend deploy    | Vercel                                     | Free tier, auto-deploy from GitHub                  |
| Backend deploy     | Railway                                    | Hobby plan, persistent volume for ChromaDB          |
| Container registry | ghcr.io + Docker Hub                       | Public images on both registries                    |

---

## Local setup

### Prerequisites

* Python 3.11+
* Node.js 20+
* A free [Groq API key](https://console.groq.com/)

### Quick start with Docker Compose

```bash
git clone https://github.com/danielamissah/resumatch.git
cd resumatch

cp .env.example .env
# Add GROQ_API_KEY to .env

docker compose up
# Backend  → http://localhost:8000
# API docs → http://localhost:8000/docs
# Frontend → http://localhost:3000
```

The sentence-transformers model (~90MB) downloads on first request and is cached to a Docker volume. Every subsequent start is instant.

### Manual setup

**Backend:**

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# Add: GROQ_API_KEY=your_key_here

uvicorn main:app --reload
# → http://localhost:8000
# → http://localhost:8000/docs
```

**Frontend:**

```bash
cd frontend
npm install

cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
# → http://localhost:3000
```

---

## Docker

### Pull and run from Docker Hub

```bash
docker pull danielamissah/resumatch:latest

docker run -p 8000:8000 \
  -e GROQ_API_KEY=your_groq_key \
  -v resumatch_chroma:/app/chroma_db \
  danielamissah/resumatch:latest
```

Then open [http://localhost:8000/docs](http://localhost:8000/docs) for the interactive API documentation.

### Pull from GitHub Container Registry

```bash
docker pull ghcr.io/danielamissah/resumatch-backend:latest
docker pull ghcr.io/danielamissah/resumatch-frontend:latest
```

### Build locally

```bash
# Backend
docker build -t resumatch-backend ./backend

# Frontend
docker build \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:8000 \
  -t resumatch-frontend ./frontend

# Both with Docker Compose
docker compose build
```

### Manual push to Docker Hub

```bash
docker build -t danielamissah/resumatch:latest ./backend
docker login
docker push danielamissah/resumatch:latest
```

---

## Environment variables

### Backend — `backend/.env`

| Variable                   | Required | Description                                           |
| -------------------------- | -------- | ----------------------------------------------------- |
| `GROQ_API_KEY`           | Yes      | From[console.groq.com](https://console.groq.com/)— free |
| `FRONTEND_URL`           | No       | Vercel URL for CORS in production                     |
| `TOKENIZERS_PARALLELISM` | No       | Set `false`to suppress HuggingFace warnings         |

### Frontend — `frontend/.env.local`

| Variable                | Required | Description                                            |
| ----------------------- | -------- | ------------------------------------------------------ |
| `NEXT_PUBLIC_API_URL` | Yes      | `http://localhost:8000`in dev · Railway URL in prod |

### Root — `.env` (Docker Compose)

| Variable                | Required | Description                        |
| ----------------------- | -------- | ---------------------------------- |
| `GROQ_API_KEY`        | Yes      | Passed to backend container        |
| `NEXT_PUBLIC_API_URL` | Yes      | Backend URL for frontend container |
| `FRONTEND_URL`        | No       | Frontend URL for CORS              |

---

## Deployment

### Backend → Railway

1. New project → Deploy from GitHub → select `resumatch` → root directory: `backend`
2. Add environment variables: `GROQ_API_KEY`, `FRONTEND_URL=https://resumatch-dka.vercel.app`, `TOKENIZERS_PARALLELISM=false`
3. Add a Volume → mount path `/app/chroma_db` — persists ChromaDB across deploys
4. Railway uses `railway.toml` automatically — Dockerfile builder, healthcheck at `/health`
5. Live at [resumatch.up.railway.app](https://resumatch.up.railway.app/)

### Frontend → Vercel

1. New project → Import from GitHub → select `resumatch` → root directory: `frontend`
2. Add environment variable: `NEXT_PUBLIC_API_URL=https://resumatch.up.railway.app`
3. Vercel auto-deploys on every push to `master`
4. Live at [resumatch-dka.vercel.app](https://resumatch-dka.vercel.app/)

### Releasing a version

```bash
git tag v1.0.0 -m "First public release"
git push --tags
```

This triggers the full CI pipeline — tests → Docker images pushed to ghcr.io and Docker Hub → backend deployed to Railway → frontend deployed to Vercel.

---

## CI/CD

| Trigger                          | Jobs                                                                     |
| -------------------------------- | ------------------------------------------------------------------------ |
| Push to `master`or `develop` | Backend tests (41) + Frontend type check                                 |
| Pull request to `master`       | Backend tests + Frontend type check                                      |
| Tag `v*`(e.g.`v1.0.0`)       | Tests + type check + Docker build & push (ghcr.io + Docker Hub) + Deploy |

GitHub Actions secrets required for full pipeline:

| Secret                  | Description             |
| ----------------------- | ----------------------- |
| `RAILWAY_TOKEN`       | Railway account token   |
| `VERCEL_TOKEN`        | Vercel account token    |
| `VERCEL_ORG_ID`       | Vercel organisation ID  |
| `VERCEL_PROJECT_ID`   | Vercel project ID       |
| `NEXT_PUBLIC_API_URL` | Railway backend URL     |
| `DOCKERHUB_USERNAME`  | Docker Hub username     |
| `DOCKERHUB_TOKEN`     | Docker Hub access token |

---

## Free tier limits

| Service               | Limit                                                                         | Notes                                               |
| --------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------- |
| Groq                  | 14,400 requests/day · 12,000 TPM                                             | Chains run sequentially with 3s buffer between them |
| sentence-transformers | Unlimited                                                                     | Runs locally on the server                          |
| ChromaDB              | Unlimited                                                                     | Persisted to disk / Railway volume                  |
| Railway Hobby         | $5/month credit                   | Backend costs ~$1–2/month at low traffic |                                                     |
| Vercel                | 100GB bandwidth/month                                                         | More than sufficient for early users                |
| Docker Hub            | Unlimited public pulls                                                        | Free for public repos                               |
| ghcr.io               | Unlimited for public repos                                                    | Free, integrated with GitHub Actions                |

Analysis takes 30–45 seconds on the Groq free tier due to sequential chain execution and rate limits. Upgrading to Groq Dev ($5/month) enables parallel execution and cuts this to ~10 seconds.

---

## Project structure

```
resumatch/
├── .github/
│   └── workflows/
│       └── ci.yml              GitHub Actions — tests on push, Docker + deploy on tags
├── backend/
│   ├── main.py                 FastAPI app, CORS, routers, health check
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── railway.toml            Railway deployment — Dockerfile builder, healthcheck
│   ├── pytest.ini              pytest config — pythonpath, testpaths
│   ├── .env.example
│   ├── models/
│   │   └── schemas.py          All Pydantic models (ParsedResume, AnalysisResult, etc.)
│   ├── routers/
│   │   ├── analyze.py          POST /analyze/text · POST /analyze/file · GET /analyze/{id}
│   │   ├── scrape.py           POST /scrape
│   │   └── export.py           GET /export/{id}/docx
│   ├── services/
│   │   ├── parser.py           Resume parsing — PDF, DOCX, plain text, section detection
│   │   ├── scraper.py          Job scraping — Lever, Greenhouse, LinkedIn, generic
│   │   ├── embeddings.py       ChromaDB + sentence-transformers RAG layer
│   │   ├── chains.py           Groq Llama 3.3 70B analysis chains (scorer, gap, rewriter)
│   │   └── export.py           Word redline document generation
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py         Shared fixtures and sample data
│       └── test_all.py         41 tests — parser, scraper, embeddings, schemas, API, export, ATS
├── frontend/
│   ├── app/
│   │   ├── page.tsx            Landing page — upload form, character counters
│   │   ├── layout.tsx
│   │   └── results/[id]/
│   │       └── page.tsx        Results dashboard — score, gaps, bullets, download
│   ├── components/
│   │   ├── ScoreCard.tsx       Section fit scores with progress bars and keyword chips
│   │   ├── GapAnalysis.tsx     Skill gaps + ATS meter + YouTube links per skill
│   │   └── BulletComparison.tsx  Side-by-side bullet rewriter with accept/reject/copy
│   ├── lib/
│   │   └── api.ts              Typed backend client
│   ├── Dockerfile
│   ├── next.config.ts          standalone output for Docker
│   └── eslint.config.mjs
├── docker-compose.yml
├── .env.example
└── .gitignore
```

---

## Roadmap

* [ ] Supabase persistence — save and retrieve past analyses across sessions
* [ ] Auth — email magic link via Clerk
* [ ] Cover letter generator — one Groq call, high perceived value
* [ ] Interview question predictor — based on JD and skill gaps
* [ ] LinkedIn headline suggester
* [ ] Stripe — waitlist to paid tier
* [ ] Kubernetes deployment manifests — when traffic justifies orchestration
* [ ] Switch to OpenAI GPT-4o when revenue covers API costs

---

## License

MIT — use it, fork it, build on it.
