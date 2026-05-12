"""
Cover Letter Router
--------------------
POST /cover-letter/generate        — generate two cover letter versions
GET  /cover-letter/{id}            — retrieve a saved result
GET  /cover-letter/{id}/export/{v} — download chosen version as .docx
"""

import os
import uuid
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from groq import AsyncGroq

from services.cover_letter import (
    CoverLetterRequest,
    CoverLetterResult,
    generate_cover_letter,
    generate_cover_letter_docx,
)

router = APIRouter(prefix="/cover-letter", tags=["cover-letter"])

# In-memory store — replaced by Supabase in future
_cover_letter_store: dict[str, CoverLetterResult] = {}
_request_store: dict[str, CoverLetterRequest] = {}


def get_groq_client() -> AsyncGroq:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")
    return AsyncGroq(api_key=api_key)


@router.post("/generate", response_model=CoverLetterResult)
async def generate(request: CoverLetterRequest) -> CoverLetterResult:
    """Generate two cover letter versions from resume + JD + personal details."""

    valid_tones = {"formal", "conversational", "confident"}
    if request.tone not in valid_tones:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid tone. Must be one of: {', '.join(valid_tones)}"
        )

    if len(request.resume_text.strip()) < 100:
        raise HTTPException(status_code=422, detail="Resume text too short")

    if len(request.job_description_text.strip()) < 50:
        raise HTTPException(status_code=422, detail="Job description too short")

    client = get_groq_client()

    try:
        result = await generate_cover_letter(request, client)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Cover letter generation failed: {str(e)}"
        )

    # Store for export retrieval
    result_id = str(uuid.uuid4())
    _cover_letter_store[result_id] = result
    _request_store[result_id] = request
    result.result_id = result_id

    # Inject result_id so frontend can use it for exports
    # result.__dict__["result_id"] = result_id

    return result


@router.get("/{result_id}", response_model=CoverLetterResult)
async def get_cover_letter(result_id: str) -> CoverLetterResult:
    """Retrieve a previously generated cover letter result."""
    result = _cover_letter_store.get(result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Cover letter result not found")
    return result


@router.get("/{result_id}/export/{version}")
async def export_cover_letter(result_id: str, version: str) -> Response:
    """Download chosen version (A or B) as a Word document."""
    if version.upper() not in ("A", "B"):
        raise HTTPException(status_code=422, detail="Version must be A or B")

    result = _cover_letter_store.get(result_id)
    request = _request_store.get(result_id)

    if not result or not request:
        raise HTTPException(status_code=404, detail="Cover letter not found")

    docx_bytes = generate_cover_letter_docx(request, result, version.upper())

    safe_name = "".join(
        c if c.isalnum() or c in " -_" else ""
        for c in (result.job_title or "cover_letter")
    ).strip().replace(" ", "_")[:40]

    filename = f"CoverLetter_{safe_name}_v{version.upper()}.docx"

    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )