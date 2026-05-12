
# ResuMatch

> **RAG-powered resume tailoring — score your fit, identify skill gaps, and get bullet rewrites tailored to any specific job.**

🔗 **Live**
[resumatch-dka.vercel.app](https://resumatch-dka.vercel.app/)

🐳 **Docker**
`docker pull danielamissah/resumatch:latest`

📄 **API Docs**
[resumatch.up.railway.app/docs](https://resumatch.up.railway.app/docs)

⭐ **GitHub**
[github.com/danielamissah/resumatch](https://github.com/danielamissah/resumatch)

---

## The problem

Most resume tools paste your resume into a GPT prompt and return generic rewrites that could apply to any job. They don't know what the specific role actually requires, which keywords the ATS will scan for, or how your experience maps to the job description.

ResuMatch is different. It uses Retrieval Augmented Generation (RAG) to retrieve the most relevant parts of the job description for each section of your resume before analysis. The output is role-specific, not generic.

Built to solve a real problem — tailoring a resume for every application while job hunting in Germany on a tight deadline.

---

## Features

* **Resume upload** — PDF, DOCX, or paste as plain text
* **Job input** — scrape from URL (Lever, Greenhouse, LinkedIn, generic) or paste directly
* **Fit Score** — section-by-section match score 0–100 with plain English explanations, matched and missing keywords per section
* **ATS Keyword Density** — percentage of JD keywords present in your resume, top missing keywords, scoring thresholds (70%+ strong · 45–69% moderate · below 45% weak)
* **Skill Gap Analysis** — missing skills ranked by priority (critical / important / nice-to-have), frequency in JD, role-specific context, actionable suggestions, and a YouTube learning link per skill
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

This is a heuristic, not a true ATS simulation. Different ATS systems use different algorithms. The density meter is a useful signal, not a guarantee.

---

## Tech stack

| Layer            | Technology                                 | Why                                                 |
| ---------------- | ------------------------------------------ | --------------------------------------------------- |
| Frontend         | Next.js 15, TypeScript                     | App router, Vercel-native, standalone Docker output |
| Styling          | Pure inline styles                         | No Tailwind compile step, works anywhere            |
| Backend          | FastAPI, Python 3.11                       | Async, typed, clean OpenAPI docs                    |
| LLM              | Groq — Llama 3.3 70B                      | Free tier, fast inference, JSON mode                |
| Embeddings       | sentence-transformers `all-MiniLM-L6-v2` | Local, free, ~90MB, downloads once                  |
| Vector store     | ChromaDB                                   | Persistent on disk, no external service needed      |
| Resume parsing   | PyMuPDF, python-docx                       | PDF + DOCX text extraction                          |
| Job scraping     | httpx, BeautifulSoup4                      | Platform-specific + generic extractors              |
| Word export      | python-docx                                | Redline document generation                         |
| Tests            | pytest, 41 tests                           | Parser, scraper, embeddings, schemas, API, export   |
| CI/CD            | GitHub Actions                             | Tests on every push, Docker on every master push    |
| Frontend deploy  | Vercel                                     | Free tier, auto-deploy from GitHub                  |
| Backend deploy   | Railway                                    | Hobby plan, persistent volume for ChromaDB          |
| Container images | Docker Hub                                 | Public images,`docker compose up`to self-host     |

---

## Self-hosting with Docker

The fastest way to run ResuMatch locally — no Python, no Node.js required.

**Step 1 — Create a `docker-compose.yml`:**

```yaml
services:
  backend:
    image: danielamissah/resumatch:latest
    ports:
      - "8000:8000"
    environment:
      - GROQ_API_KEY=your_groq_key_here
      - TOKENIZERS_PARALLELISM=false
    volumes:
      - chroma_data:/app/chroma_db
      - model_cache:/app/.cache

  frontend:
    image: danielamissah/resumatch-frontend:latest
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
    depends_on:
      - backend

volumes:
  chroma_data:
  model_cache:
```

**Step 2 — Get a free Groq API key:**

Sign up at [console.groq.com](https://console.groq.com/) — free, no credit card required.

**Step 3 — Run:**

```bash
docker compose up
```

* Frontend → [http://localhost:3000](http://localhost:3000/)
* API docs → [http://localhost:8000/docs](http://localhost:8000/docs)

The sentence-transformers model (~90MB) downloads on first start and is cached to a volume. Every subsequent start is instant.

---

## Local development setup

### Prerequisites

* Python 3.11+
* Node.js 20+
* A free [Groq API key](https://console.groq.com/)

### Backend

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

### Frontend

```bash
cd frontend
npm install

cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
# → http://localhost:3000
```

### Run tests

```bash
cd backend
source venv/bin/activate
pytest tests/ -v
```

41 tests covering parser, scraper, embeddings, schemas, API endpoints, Word export, and ATS density logic.

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

---

## Deployment

### Backend → Railway

1. New project → Deploy from GitHub → select `resumatch` → root directory: `backend`
2. Add environment variables: `GROQ_API_KEY`, `FRONTEND_URL=https://resumatch-dka.vercel.app`, `TOKENIZERS_PARALLELISM=false`
3. Add a Volume → mount path `/app/chroma_db` — persists ChromaDB across deploys
4. Railway auto-deploys on every push to `master`
5. Live at [resumatch.up.railway.app](https://resumatch.up.railway.app/)

### Frontend → Vercel

1. New project → Import from GitHub → select `resumatch` → root directory: `frontend`
2. Add environment variable: `NEXT_PUBLIC_API_URL=https://resumatch.up.railway.app`
3. Vercel auto-deploys on every push to `master`
4. Live at [resumatch-dka.vercel.app](https://resumatch-dka.vercel.app/)

---

## CI/CD

| Trigger                          | Jobs                                                           |
| -------------------------------- | -------------------------------------------------------------- |
| Push to `master`or `develop` | Backend tests (41) + Frontend type check + Docker build & push |
| Pull request to `master`       | Backend tests + Frontend type check                            |

```
Push to master
      │
      ├── Backend Tests (41 tests)    ─┐
      │                                ├── both must pass
      └── Frontend Type Check         ─┘
                    │
            Build & Push to Docker Hub
            danielamissah/resumatch:latest
            danielamissah/resumatch-frontend:latest

Deployments (automatic via GitHub integration)
      ├── Railway  → redeploys backend on every push
      └── Vercel   → redeploys frontend on every push
```

GitHub Actions secrets required:

| Secret                  | Description                            |
| ----------------------- | -------------------------------------- |
| `DOCKERHUB_USERNAME`  | Docker Hub username                    |
| `DOCKERHUB_TOKEN`     | Docker Hub access token (Read & Write) |
| `NEXT_PUBLIC_API_URL` | Railway backend URL                    |

---

## Free tier limits

| Service               | Limit                                                                         | Notes                                  |
| --------------------- | ----------------------------------------------------------------------------- | -------------------------------------- |
| Groq                  | 14,400 requests/day · 12,000 TPM                                             | Chains run sequentially with 3s buffer |
| sentence-transformers | Unlimited                                                                     | Runs locally on the server             |
| ChromaDB              | Unlimited                                                                     | Persisted to Railway volume            |
| Railway Hobby         | $5/month credit                   | Backend costs ~$1–2/month at low traffic |                                        |
| Vercel                | 100GB bandwidth/month                                                         | More than sufficient                   |
| Docker Hub            | Unlimited public pulls                                                        | Free for public repos                  |

Analysis takes 30–45 seconds on the Groq free tier. Upgrading to Groq Dev ($5/month) enables parallel chain execution and cuts this to ~10 seconds.

---

## Project structure

```
resumatch/
├── .github/
│   └── workflows/
│       └── ci.yml              Tests on every push, Docker on master
├── backend/
│   ├── main.py                 FastAPI app, CORS, routers, health check
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── railway.toml
│   ├── pytest.ini
│   ├── .env.example
│   ├── models/
│   │   └── schemas.py          All Pydantic models
│   ├── routers/
│   │   ├── analyze.py          POST /analyze/text · POST /analyze/file
│   │   ├── scrape.py           POST /scrape
│   │   └── export.py           GET /export/{id}/docx
│   ├── services/
│   │   ├── parser.py           Resume parsing — PDF, DOCX, plain text
│   │   ├── scraper.py          Job scraping — Lever, Greenhouse, generic
│   │   ├── embeddings.py       ChromaDB + sentence-transformers RAG
│   │   ├── chains.py           Groq Llama 3.3 70B analysis chains
│   │   └── export.py           Word redline document generation
│   └── tests/
│       ├── conftest.py
│       └── test_all.py         41 tests
├── frontend/
│   ├── app/
│   │   ├── page.tsx            Landing page
│   │   └── results/[id]/
│   │       └── page.tsx        Results dashboard
│   ├── components/
│   │   ├── ScoreCard.tsx
│   │   ├── GapAnalysis.tsx     Skill gaps + ATS meter + YouTube links
│   │   └── BulletComparison.tsx
│   └── lib/
│       └── api.ts              Typed backend client
├── docker-compose.yml
├── .env.example
└── .gitignore
```

---

## Roadmap

* [ ] Supabase persistence — save and retrieve past analyses
* [ ] Auth — email magic link
* [ ] Cover letter generator — one Groq call, high perceived value
* [ ] Interview question predictor — based on JD and skill gaps
* [ ] LinkedIn headline suggester
* [ ] Stripe — waitlist to paid tier
* [ ] Kubernetes deployment — when traffic justifies orchestration

---

## About

**Daniel Kwame Amissah** is an ML Research Engineer based in Hamburg, Germany, with 5 peer-reviewed publications and hands-on experience building production AI systems and full-stack web applications.

His research spans computer vision (Vision Transformers for age-invariant face recognition), healthcare ML (DMA-WOA optimisation for PCOS diagnosis), cybersecurity (Bitcoin ransomware detection with dimensionality reduction), and plant disease classification. He has presented at the International Conference on Artificial Intelligence and Networking (ICAIN 2025, Delhi).

On the engineering side he builds RAG pipelines, multi-agent LLM systems, and full-stack web applications — and deploys them to production. ResuMatch was built to solve a real problem he faced personally: tailoring a resume for every application while job hunting in Germany on a tight timeline with the Opportunity Card.

**Published research:**

* DMA-WOA for PCOS Diagnosis — Applied AI Letters, 2026
* Early Blight Detection in Tomatoes with Modified MobileNet — Scientific Reports, 2026
* Vision Transformer for Age-Invariant Face Recognition — Applied AI Letters, 2025
* Bitcoin Ransomware Detection with Incremental PCA and UMAP — Security and Privacy, 2025
* AI and Healthcare: PCOS Diagnosis — Operations Research Forum, 2025

**Links:**

* Portfolio: [danielkwameamissah.com](https://www.danielkwameamissah.com/)
* GitHub: [github.com/danielamissah](https://github.com/danielamissah)
* HuggingFace: [huggingface.co/dkamissah](https://huggingface.co/dkamissah)
* LinkedIn: [linkedin.com/in/danielkamissah](https://www.linkedin.com/in/danielkamissah/)
* Google Scholar: [scholar.google.com/citations?user=6XPh5FkAAAAJ](https://scholar.google.com/citations?user=6XPh5FkAAAAJ)

---

## License

MIT — use it, fork it, build on it.
