"""
Export Router
-------------
GET /export/{analysis_id}/docx — download redline Word document
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from routers.analyze import _analysis_store
from services.export import generate_redline_docx

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/{analysis_id}/docx")
async def export_docx(analysis_id: str):
    """
    Generate and stream a redline .docx file for a completed analysis.
    Original bullets shown in red strikethrough, rewrites in green underline.
    """
    result = _analysis_store.get(analysis_id)
    if not result:
        raise HTTPException(
            status_code=404,
            detail="Analysis not found. Run a new analysis first."
        )

    if not result.bullet_rewrites.rewrites:
        raise HTTPException(
            status_code=400,
            detail="No bullet rewrites found in this analysis."
        )

    docx_bytes = generate_redline_docx(result)

    # Safe filename from job title
    job_title = result.job.title or "resume"
    safe_name = "".join(c if c.isalnum() or c in " -_" else "" for c in job_title)
    safe_name = safe_name.strip().replace(" ", "_")[:40] or "resume"
    filename = f"ResuMatch_Redline_{safe_name}.docx"

    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )