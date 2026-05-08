import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from models.schemas import HealthResponse
from routers import analyze_router, scrape_router

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    required_vars = ["OPENAI_API_KEY"]
    missing = [v for v in required_vars if not os.getenv(v)]
    if missing:
        raise RuntimeError(f"Missing required env vars: {', '.join(missing)}")
    print("✓ ResuMatch backend started")
    yield

app = FastAPI(title="ResuMatch API", version="1.0.0", lifespan=lifespan)

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://resumatch.vercel.app",
    os.getenv("FRONTEND_URL", ""),
]
app.add_middleware(CORSMiddleware, allow_origins=[o for o in ALLOWED_ORIGINS if o], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(analyze_router)
app.include_router(scrape_router)

@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check():
    return HealthResponse(status="ok", version="1.0.0", services={"openai": "configured" if os.getenv("OPENAI_API_KEY") else "missing"})

@app.get("/")
async def root():
    return {"name": "ResuMatch API", "version": "1.0.0", "docs": "/docs"}
