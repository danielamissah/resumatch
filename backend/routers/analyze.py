import time
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from groq import AsyncGroq
import os

from models.schemas import AnalyzeRequest, AnalysisResult, AnalysisStatus, InputFormat
from services.parser import parse_resume
from services.scraper import scrape_job_description, parse_job_description_text
from services.embeddings import embed_and_store_jd
from services.chains import run_all_chains

router = APIRouter(prefix="/analyze", tags=["analyze"])
_analysis_store: dict[str, AnalysisResult] = {}


def get_groq_client() -> AsyncGroq:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured in .env")
    return AsyncGroq(api_key=api_key)


async def _run_analysis(resume, jd) -> AnalysisResult:
    """Shared analysis logic for both text and file endpoints."""
    start = time.time()
    client = get_groq_client()

    # Embed JD — synchronous, local, free
    jd_id = embed_and_store_jd(jd)

    # Run all three chains in parallel against Groq
    match_score, gap_analysis, bullet_rewrites = await run_all_chains(
        resume=resume, jd=jd, jd_id=jd_id, client=client
    )

    analysis_id = str(uuid.uuid4())
    result = AnalysisResult(
        analysis_id=analysis_id,
        status=AnalysisStatus.COMPLETE,
        resume=resume, job=jd,
        match_score=match_score,
        gap_analysis=gap_analysis,
        bullet_rewrites=bullet_rewrites,
        created_at=datetime.now(timezone.utc).isoformat(),
        processing_time_ms=int((time.time() - start) * 1000)
    )
    _analysis_store[analysis_id] = result
    return result


@router.post("/text", response_model=AnalysisResult)
async def analyze_text(request: AnalyzeRequest) -> AnalysisResult:
    if not request.job_description_text and not request.job_url:
        raise HTTPException(status_code=422, detail="Provide either job_description_text or job_url")

    try:
        resume = parse_resume(request.resume_text, InputFormat.TEXT)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Resume parsing failed: {e}")

    try:
        jd = await scrape_job_description(request.job_url) if request.job_url else parse_job_description_text(request.job_description_text)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Job description error: {e}")

    return await _run_analysis(resume, jd)


@router.post("/file", response_model=AnalysisResult)
async def analyze_file(
    resume_file: UploadFile = File(...),
    job_description_text: str = Form(default=None),
    job_url: str = Form(default=None),
) -> AnalysisResult:
    if not job_description_text and not job_url:
        raise HTTPException(status_code=422, detail="Provide either job_description_text or job_url")

    filename = resume_file.filename or ""
    if filename.lower().endswith(".pdf"):
        file_format = InputFormat.PDF
    elif filename.lower().endswith(".docx"):
        file_format = InputFormat.DOCX
    else:
        raise HTTPException(status_code=422, detail="Upload a PDF or DOCX file.")

    file_bytes = await resume_file.read()
    if len(file_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Max 5MB.")

    try:
        resume = parse_resume(file_bytes, file_format)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Resume parsing failed: {e}")

    try:
        jd = await scrape_job_description(job_url) if job_url else parse_job_description_text(job_description_text)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Job description error: {e}")

    return await _run_analysis(resume, jd)


@router.get("/{analysis_id}", response_model=AnalysisResult)
async def get_analysis(analysis_id: str) -> AnalysisResult:
    result = _analysis_store.get(analysis_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Analysis {analysis_id} not found.")
    return result