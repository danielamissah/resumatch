from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class InputFormat(str, Enum):
    PDF = "pdf"
    DOCX = "docx"
    TEXT = "text"


class AnalysisStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETE = "complete"
    FAILED = "failed"


class ResumeSection(BaseModel):
    title: str
    content: str
    bullets: list[str] = Field(default_factory=list)


class ParsedResume(BaseModel):
    raw_text: str
    sections: list[ResumeSection]
    skills: list[str] = Field(default_factory=list)
    format: InputFormat
    word_count: int


class JobDescription(BaseModel):
    raw_text: str
    title: str = ""
    company: str = ""
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    responsibilities: list[str] = Field(default_factory=list)
    source_url: Optional[str] = None


class SectionScore(BaseModel):
    section: str
    score: int = Field(..., ge=0, le=100)
    explanation: str
    top_matches: list[str] = Field(default_factory=list)
    top_gaps: list[str] = Field(default_factory=list)


class MatchScore(BaseModel):
    overall: int = Field(..., ge=0, le=100)
    sections: list[SectionScore]
    verdict: str
    summary: str


class SkillGap(BaseModel):
    skill: str
    priority: str
    frequency: int
    context: str
    suggestion: str


class GapAnalysis(BaseModel):
    missing_skills: list[SkillGap]
    present_skills: list[str]
    transferable_skills: list[str]
    critical_gaps_count: int


class BulletRewrite(BaseModel):
    original: str
    rewritten: str
    keywords_added: list[str]
    explanation: str
    section: str


class BulletRewrites(BaseModel):
    rewrites: list[BulletRewrite]
    total_bullets: int
    sections_covered: list[str]


class AnalyzeRequest(BaseModel):
    resume_text: str
    job_description_text: Optional[str] = None
    job_url: Optional[str] = None


class ScrapeRequest(BaseModel):
    url: str


class ScrapeResponse(BaseModel):
    success: bool
    job_description: Optional[JobDescription] = None
    error: Optional[str] = None
    raw_text: Optional[str] = None


class AnalysisResult(BaseModel):
    analysis_id: str
    status: AnalysisStatus = AnalysisStatus.COMPLETE
    resume: ParsedResume
    job: JobDescription
    match_score: MatchScore
    gap_analysis: GapAnalysis
    bullet_rewrites: BulletRewrites
    created_at: str
    processing_time_ms: int


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    services: dict[str, str] = Field(default_factory=dict)
