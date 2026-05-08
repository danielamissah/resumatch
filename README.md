# ResuMatch

RAG-powered resume tailoring — score your fit, find skill gaps, get bullet rewrites.

## Quick Start

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # add your OPENAI_API_KEY
uvicorn main:app --reload   # → http://localhost:8000/docs
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local  # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                  # → http://localhost:3000
```

## Deploy
- **Backend → Railway**: connect repo, set OPENAI_API_KEY env var, done
- **Frontend → Vercel**: connect repo, set NEXT_PUBLIC_API_URL to your Railway URL, done
