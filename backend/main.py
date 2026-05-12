import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from models.schemas import HealthResponse
from routers import analyze_router, scrape_router, export_router, cover_letter_router

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    required_vars = ["GROQ_API_KEY"]
    missing = [v for v in required_vars if not os.getenv(v)]
    if missing:
        raise RuntimeError(f"Missing required env vars: {', '.join(missing)}")
    print("ResuMatch backend started")
    yield

app = FastAPI(title="ResuMatch API", version="1.0.0", lifespan=lifespan)

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://resumatch-dka.vercel.app",
    os.getenv("FRONTEND_URL", ""),
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

@app.options("/{rest_of_path:path}")
async def preflight_handler(request: Request, rest_of_path: str):
    return JSONResponse(
        content={},
        headers={
            "Access-Control-Allow-Origin": "https://resumatch-dka.vercel.app",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Credentials": "true",
        }
    )


app.include_router(analyze_router)
app.include_router(scrape_router)
app.include_router(export_router)
app.include_router(cover_letter_router)

@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check():
    return HealthResponse(status="ok", version="1.0.0", services={"openai": "configured" if os.getenv("OPENAI_API_KEY") else "missing"})

@app.get("/")
async def root():
    return {"name": "ResuMatch API", "version": "1.0.0", "docs": "/docs"}
