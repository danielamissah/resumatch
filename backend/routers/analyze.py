import time
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from openai import AsyncOpenAI
import os

from models.schemas import AnalyzeRequest, AnalysisResult, AnalysisStatus, InputFormat
from services.parser import parse_resume
from services.scraper import scrape_job_description, parse_job_description_text
from services.embeddings import embed_and_store_jd
from services.chains import run_all_chains

router = APIRouter(prefix="/analyze", tags=["analyze"])
_analysis_store: dict[str, AnalysisResult] = {}


def get_openai_client() -> AsyncOpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")
    return AsyncOpenAI(api_key=api_key)


@router.post("/text", response_model=AnalysisResult)
async def analyze_text(request: AnalyzeRequest) -> AnalysisResult:
    if not request.job_description_text and not request.job_url:
        raise HTTPException(status_code=422, detail="Either job_description_text or job_url must be provided")

    start_time = time.time()
    openai_client = get_openai_client()

    try:
        resume = parse_resume(request.resume_text, InputFormat.TEXT)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Resume parsing failed: {str(e)}")

    try:
        jd = await scrape_job_description(request.job_url) if request.job_url else parse_job_description_text(request.job_description_text)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Job description error: {str(e)}")

    jd_id = await embed_and_store_jd(jd, openai_client)
    match_score, gap_analysis, bullet_rewrites = await run_all_chains(resume=resume, jd=jd, jd_id=jd_id, openai_client=openai_client)

    analysis_id = str(uuid.uuid4())
    result = AnalysisResult(
        analysis_id=analysis_id, status=AnalysisStatus.COMPLETE,
        resume=resume, job=jd, match_score=match_score,
        gap_analysis=gap_analysis, bullet_rewrites=bullet_rewrites,
        created_at=datetime.now(timezone.utc).isoformat(),
        processing_time_ms=int((time.time() - start_time) * 1000)
    )
    _analysis_store[analysis_id] = result
    return result


@router.post("/file", response_model=AnalysisResult)
async def analyze_file(
    resume_file: UploadFile = File(...),
    job_description_text: str = Form(default=None),
    job_url: str = Form(default=None),
) -> AnalysisResult:
    if not job_description_text and not job_url:
        raise HTTPException(status_code=422, detail="Either job_description_text or job_url must be provided")

    filename = resume_file.filename or ""
    if filename.lower().endswith(".pdf"):
        file_format = InputFormat.PDF
    elif filename.lower().endswith(".docx"):
        file_format = InputFormat.DOCX
    else:
        raise HTTPException(status_code=422, detail="Unsupported file format. Please upload a PDF or DOCX file.")

    start_time = time.time()
    openai_client = get_openai_client()
    file_bytes = await resume_file.read()

    if len(file_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 5MB.")

    try:
        resume = parse_resume(file_bytes, file_format)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Resume parsing failed: {str(e)}")

    try:
        jd = await scrape_job_description(job_url) if job_url else parse_job_description_text(job_description_text)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Job description error: {str(e)}")

    jd_id = await embed_and_store_jd(jd, openai_client)
    match_score, gap_analysis, bullet_rewrites = await run_all_chains(resume=resume, jd=jd, jd_id=jd_id, openai_client=openai_client)

    analysis_id = str(uuid.uuid4())
    result = AnalysisResult(
        analysis_id=analysis_id, status=AnalysisStatus.COMPLETE,
        resume=resume, job=jd, match_score=match_score,
        gap_analysis=gap_analysis, bullet_rewrites=bullet_rewrites,
        created_at=datetime.now(timezone.utc).isoformat(),
        processing_time_ms=int((time.time() - start_time) * 1000)
    )
    _analysis_store[analysis_id] = result
    return result


@router.get("/{analysis_id}", response_model=AnalysisResult)
async def get_analysis(analysis_id: str) -> AnalysisResult:
    result = _analysis_store.get(analysis_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Analysis {analysis_id} not found.")
    return result
