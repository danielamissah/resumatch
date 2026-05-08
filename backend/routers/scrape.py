from fastapi import APIRouter, HTTPException
from models.schemas import ScrapeRequest, ScrapeResponse
from services.scraper import scrape_job_description

router = APIRouter(prefix="/scrape", tags=["scrape"])

@router.post("", response_model=ScrapeResponse)
async def scrape_job(request: ScrapeRequest) -> ScrapeResponse:
    try:
        jd = await scrape_job_description(request.url)
        return ScrapeResponse(success=True, job_description=jd, raw_text=jd.raw_text)
    except ValueError as e:
        return ScrapeResponse(success=False, error=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
