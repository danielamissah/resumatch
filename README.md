
# ResuMatch

**RAG-powered resume tailoring. Score your fit, identify skill gaps, and get bullet rewrites tailored to any specific job — at zero cost.**

Built with FastAPI, Next.js, Groq (Llama 3.3 70B), ChromaDB, and sentence-transformers.

---

## What it does

Most resume tools paste your resume into a GPT prompt and return generic rewrites. ResuMatch is different.

For every analysis, it:

1. **Parses your resume** into structured sections (Experience, Skills, Education, Projects, Publications)
2. **Scrapes or parses the job description** into structured requirements and responsibilities
3. **Embeds the JD into ChromaDB** using sentence-transformers (local, free)
4. **Retrieves the most relevant JD chunks** for each resume section using cosine similarity
5. **Runs three analysis chains** against Groq's Llama 3.3 70B, each injected with RAG context:
   * **Match Scorer** — scores each section 0–100 with explanation
   * **Gap Analyser** — identifies missing skills with priority, frequency, and role-specific context
   * **Bullet Rewriter** — rewrites each bullet using retrieved JD keywords, not generic advice
6. **Computes ATS keyword density** — pure frontend calculation, no API call
7. **Generates a redline Word document** — original bullets in red strikethrough, rewrites in green underline

---

## Features

* Resume upload — PDF, DOCX, or paste as plain text
* Job input — scrape from URL (Lever, Greenhouse, LinkedIn, generic) or paste directly
* Section-by-section fit score with matched and missing keywords
* Skill gap analysis ranked by priority (critical / important / nice-to-have)
* YouTube learning links — each skill gap links to a targeted YouTube search, not a generic page
* ATS keyword density meter with top missing keywords
* Side-by-side bullet rewriter with accept / reject / copy per bullet
* Download redline `.docx` — opens in Word, Google Docs, LibreOffice
* Character counters with live limits so you stay within free tier token budgets
* Zero cost — Groq free tier + local sentence-transformers embeddings

---

## Tech stack

| Layer           | Technology                                 | Why                                  |
| --------------- | ------------------------------------------ | ------------------------------------ |
| Frontend        | Next.js 15, TypeScript                     | App router, fast dev experience      |
| Styling         | Pure inline styles                         | No Tailwind compile step needed      |
| Backend         | FastAPI, Python 3.11                       | Async, fast, clean OpenAPI docs      |
| LLM             | Groq — Llama 3.3 70B                      | Free tier, fast inference, JSON mode |
| Embeddings      | sentence-transformers `all-MiniLM-L6-v2` | Local, free, downloads once          |
| Vector store    | ChromaDB                                   | Persistent, no external service      |
| Resume parsing  | PyMuPDF, python-docx                       | PDF + DOCX extraction                |
| Job scraping    | httpx, BeautifulSoup4                      | Lever, Greenhouse, generic pages     |
| Word export     | python-docx                                | Redline document generation          |
| Frontend deploy | Vercel                                     | Free tier                            |
| Backend deploy  | Railway                                    | Free tier with volume support        |

---

## Architecture

```
User uploads resume + job URL or text
            │
            ▼
    FastAPI Backend
            │
    ┌───────┴────────┐
    │                │
Resume Parser    Job Scraper
(PDF/DOCX/text)  (httpx + BS4)
    │                │
    └───────┬────────┘
            │
    ChromaDB Embeddings
    (sentence-transformers)
    JD chunked + stored locally
            │
    RAG Retrieval
    Top-k chunks per resume section
            │
    ┌───────┼────────┐
    │       │        │
 Scorer  Gap      Rewriter
 Chain  Analyser   Chain
    │       │        │
    └───────┴────────┘
            │
    Groq Llama 3.3 70B
    (sequential, rate-limit safe)
            │
    AnalysisResult JSON
            │
    Next.js Frontend
    ┌───────┼────────┐
    │       │        │
 Score   Gaps    Bullets
  Tab    Tab      Tab
                   │
             Download .docx
```

---

## Local setup

### Prerequisites

* Python 3.11+
* Node.js 18+
* A free [Groq API key](https://console.groq.com/)

### Backend

```bash
cd resumatch/backend

python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# Edit .env and add:
# GROQ_API_KEY=your_key_here

uvicorn main:app --reload
# → http://localhost:8000
# → http://localhost:8000/docs   (Swagger UI)
```

On first run, `all-MiniLM-L6-v2` (~90MB) downloads once and is cached locally. Every subsequent run is instant.

### Frontend

```bash
cd resumatch/frontend

npm install

cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
# → http://localhost:3000
```

---

## Environment variables

### Backend — `backend/.env`

| Variable         | Required | Description                            |
| ---------------- | -------- | -------------------------------------- |
| `GROQ_API_KEY` | Yes      | From console.groq.com — free tier     |
| `FRONTEND_URL` | No       | Your Vercel URL for CORS in production |

### Frontend — `frontend/.env.local`

| Variable                | Required | Description                                   |
| ----------------------- | -------- | --------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | Yes      | Backend URL —`http://localhost:8000`in dev |

---

## Deployment

### Backend → Railway

1. Push `backend/` to a GitHub repo
2. Connect to [Railway](https://railway.app/)
3. Add environment variable: `GROQ_API_KEY`
4. Add a persistent volume mounted at `/app/chroma_db` — this keeps your vector store across deploys
5. Railway uses `railway.toml` automatically — no config needed

### Frontend → Vercel

1. Push `frontend/` to GitHub
2. Connect to [Vercel](https://vercel.com/)
3. Add environment variable: `NEXT_PUBLIC_API_URL=https://your-app.railway.app`
4. Deploy

---

## Free tier limits

| Service               | Limit                           | Notes                                     |
| --------------------- | ------------------------------- | ----------------------------------------- |
| Groq                  | 14,400 requests/day, 12,000 TPM | Chains run sequentially to stay under TPM |
| Groq                  | ~6,000 tokens per request       | Resume + JD inputs are trimmed to fit     |
| sentence-transformers | Unlimited                       | Runs locally, no API                      |
| ChromaDB              | Unlimited                       | Persisted on disk                         |
| Railway               | 500 hours/month free            | Enough for personal + early users         |
| Vercel                | 100GB bandwidth/month           | More than sufficient                      |

To stay within Groq's token-per-minute limit, chains run sequentially with a 3-second buffer between them. This means analysis takes 30–45 seconds on the free tier. Upgrading to Groq Dev ($5/month) removes this constraint entirely.

---

## ATS keyword density

The ATS density meter is a pure frontend calculation — no API call, instant result.

**How it works:**

1. Split both the JD and resume into individual words
2. Remove noise words (`the`, `and`, `with`, `your`, `will`, `experience`, `strong`, ~60 total)
3. Filter to words longer than 3 characters
4. Deduplicate the JD keyword set
5. Check how many unique JD keywords appear anywhere in the resume text (case-insensitive substring match)
6. Density = matched keywords ÷ total JD keywords × 100

**Thresholds:** 70%+ = strong, 45–69% = moderate, below 45% = weak.

This is a heuristic, not a true ATS simulation — different ATS systems (Workday, Greenhouse, Lever, Taleo) use different algorithms. The density meter gives a useful signal, not a guarantee.

---

## Project structure

```
resumatch/
├── backend/
│   ├── main.py                 Application entry point, CORS, routers
│   ├── requirements.txt
│   ├── railway.toml            Railway deployment config
│   ├── .env.example
│   ├── models/
│   │   └── schemas.py          All Pydantic models
│   ├── routers/
│   │   ├── analyze.py          POST /analyze/text, POST /analyze/file
│   │   ├── scrape.py           POST /scrape
│   │   └── export.py           GET /export/{id}/docx
│   └── services/
│       ├── parser.py           Resume parsing — PDF, DOCX, plain text
│       ├── scraper.py          Job description scraping
│       ├── embeddings.py       ChromaDB + sentence-transformers
│       ├── chains.py           Groq analysis chains
│       └── export.py           Word redline document generation
│
└── frontend/
    ├── app/
    │   ├── page.tsx            Landing page + upload form
    │   ├── layout.tsx
    │   └── results/[id]/
    │       └── page.tsx        Results dashboard
    ├── components/
    │   ├── ScoreCard.tsx       Section-by-section fit scores
    │   ├── GapAnalysis.tsx     Skill gaps + YouTube links + ATS meter
    │   └── BulletComparison.tsx  Side-by-side bullet rewriter
    └── lib/
        └── api.ts              Typed backend client
```

---

## Roadmap

* [ ] Supabase persistence — save and retrieve past analyses across sessions
* [ ] Auth — email magic link via Clerk
* [ ] Cover letter generator — one Groq call, high user value
* [ ] Interview question predictor — based on JD + skill gaps
* [ ] LinkedIn headline suggester
* [ ] Stripe integration — waitlist → paid tier
* [ ] Switch to OpenAI GPT-4o once revenue covers API costs


---

## License

MIT
