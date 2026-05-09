"""
ResuMatch Backend Test Suite
-----------------------------
Tests cover:
  - Resume parser (PDF, DOCX, plain text)
  - Job description scraper (text parsing)
  - Embeddings (chunk logic, JD id generation)
  - Analysis chains (mocked Groq)
  - API endpoints (mocked services)
  - ATS density logic

Run with:
    pytest tests/ -v
    pytest tests/ -v --cov=. --cov-report=term-missing
"""

import io
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient


# Parser Tests 

class TestResumeParser:
    """Test resume parsing across all three input formats."""

    def test_parse_plain_text_returns_parsed_resume(self):
        from services.parser import parse_resume
        from models.schemas import InputFormat

        text = """
John Doe
ML Engineer

EXPERIENCE
- Developed LSTM autoencoder deployed on AWS SageMaker
- Built RAG pipeline over 389 arXiv papers using LangChain

SKILLS
Python, PyTorch, FastAPI, Docker, AWS

EDUCATION
BSc Computer Science, University of Ghana
"""
        result = parse_resume(text.strip(), InputFormat.TEXT)
        assert result.word_count > 0
        assert result.raw_text == text.strip()
        assert result.format == InputFormat.TEXT
        assert len(result.sections) > 0

    def test_parse_plain_text_extracts_skills(self):
        from services.parser import parse_resume
        from models.schemas import InputFormat

        text = "Experience with Python, PyTorch, Docker, FastAPI, and PostgreSQL."
        result = parse_resume(text, InputFormat.TEXT)
        skill_names = [s.lower() for s in result.skills]
        assert "python" in skill_names
        assert "pytorch" in skill_names
        assert "docker" in skill_names

    def test_parse_plain_text_detects_sections(self):
        from services.parser import parse_resume
        from models.schemas import InputFormat

        text = """
EXPERIENCE
Built full-stack applications using Next.js and FastAPI.

SKILLS
Python, TypeScript, React

EDUCATION
BSc Computer Science
"""
        result = parse_resume(text.strip(), InputFormat.TEXT)
        section_titles = [s.title.lower() for s in result.sections]
        assert any("experience" in t for t in section_titles)
        assert any("skill" in t for t in section_titles)

    def test_parse_extracts_bullets(self):
        from services.parser import parse_resume
        from models.schemas import InputFormat

        text = """
EXPERIENCE
- Developed a neural network achieving 94% accuracy
- Deployed models on AWS SageMaker with monitoring
- Reduced inference latency by 40% through quantisation
"""
        result = parse_resume(text.strip(), InputFormat.TEXT)
        all_bullets = [b for s in result.sections for b in s.bullets]
        assert len(all_bullets) >= 2

    def test_empty_text_raises_value_error(self):
        from services.parser import parse_resume
        from models.schemas import InputFormat

        with pytest.raises(ValueError, match="Could not extract"):
            parse_resume("   ", InputFormat.TEXT)

    def test_unsupported_format_raises_value_error(self):
        from services.parser import parse_resume

        with pytest.raises((ValueError, AttributeError)):
            parse_resume("some text", "csv")  # type: ignore

    def test_word_count_is_correct(self):
        from services.parser import parse_resume
        from models.schemas import InputFormat

        text = "one two three four five"
        result = parse_resume(text, InputFormat.TEXT)
        assert result.word_count == 5


# Section Detection Tests 

class TestSectionDetection:
    """Test section heading detection heuristics."""

    def test_detects_known_section_headings(self):
        from services.parser import detect_section_heading

        assert detect_section_heading("EXPERIENCE") is True
        assert detect_section_heading("Experience") is True
        assert detect_section_heading("Work Experience") is True
        assert detect_section_heading("SKILLS") is True
        assert detect_section_heading("Education") is True
        assert detect_section_heading("Publications") is True
        assert detect_section_heading("Projects") is True

    def test_rejects_normal_sentences(self):
        from services.parser import detect_section_heading

        assert detect_section_heading("I worked at Google for three years") is False
        assert detect_section_heading("") is False
        assert detect_section_heading("Developed a machine learning pipeline") is False

    def test_detects_all_caps_short_lines(self):
        from services.parser import detect_section_heading

        assert detect_section_heading("AWARDS") is True
        assert detect_section_heading("CERTIFICATIONS") is True


# Scraper Tests 

class TestJobScraper:
    """Test job description text parsing (URL scraping mocked separately)."""

    def test_parse_jd_text_returns_job_description(self):
        from services.scraper import parse_job_description_text

        jd = """
ML Engineer at Acme Corp

We are looking for an ML Engineer to join our team.

Requirements:
- 3+ years of Python experience
- Strong knowledge of PyTorch and deep learning
- Experience with AWS and Docker
- Familiarity with MLflow and model deployment

Responsibilities:
- Train and deploy machine learning models
- Build data pipelines for model training
- Collaborate with product and engineering teams
"""
        result = parse_job_description_text(jd.strip())
        assert len(result.raw_text) > 50
        assert len(result.required_skills) > 0

    def test_parse_jd_too_short_raises_error(self):
        from services.scraper import parse_job_description_text

        with pytest.raises(ValueError, match="too short"):
            parse_job_description_text("hire me")

    def test_extract_responsibilities(self):
        from services.scraper import extract_responsibilities

        text = """
Responsibilities:
- Train and evaluate machine learning models
- Deploy models to production using SageMaker
- Monitor model performance and retrain as needed
"""
        result = extract_responsibilities(text)
        assert len(result) >= 2
        assert any("train" in r.lower() for r in result)

    def test_extract_required_skills(self):
        from services.scraper import extract_required_skills

        text = """
Requirements:
- Proficiency in Python and PyTorch
- Experience with Docker and Kubernetes
- Strong understanding of deep learning
"""
        result = extract_required_skills(text)
        assert len(result) >= 1

    def test_detect_platform_lever(self):
        from services.scraper import detect_platform

        assert detect_platform("https://jobs.lever.co/acme/ml-engineer") == "lever"

    def test_detect_platform_greenhouse(self):
        from services.scraper import detect_platform

        assert detect_platform("https://boards.greenhouse.io/acme/jobs/123") == "greenhouse"

    def test_detect_platform_generic(self):
        from services.scraper import detect_platform

        assert detect_platform("https://careers.acme.com/jobs/123") == "generic"

    def test_clean_jd_text_normalises_whitespace(self):
        from services.scraper import clean_jd_text

        dirty = "line one\r\nline two\n\n\n\nline three"
        result = clean_jd_text(dirty)
        assert "\r" not in result
        assert "\n\n\n" not in result


# Embeddings Tests 

class TestEmbeddings:
    """Test chunking and JD ID generation (ChromaDB calls mocked)."""

    def test_chunk_text_short_text_returns_single_chunk(self):
        from services.embeddings import chunk_text

        text = "short text with only a few words"
        result = chunk_text(text, chunk_size=200)
        assert len(result) == 1
        assert result[0] == text

    def test_chunk_text_long_text_returns_multiple_chunks(self):
        from services.embeddings import chunk_text

        text = " ".join([f"word{i}" for i in range(500)])
        result = chunk_text(text, chunk_size=200, overlap=40)
        assert len(result) > 1

    def test_chunk_text_overlap_preserves_context(self):
        from services.embeddings import chunk_text

        words = [f"w{i}" for i in range(300)]
        text = " ".join(words)
        chunks = chunk_text(text, chunk_size=100, overlap=20)
        # Last word of chunk N should appear in chunk N+1 (overlap)
        chunk0_words = set(chunks[0].split())
        chunk1_words = set(chunks[1].split())
        assert len(chunk0_words & chunk1_words) > 0

    def test_generate_jd_id_is_deterministic(self):
        from services.embeddings import generate_jd_id
        from models.schemas import JobDescription

        jd = JobDescription(raw_text="Python developer role", title="Dev", company="Acme")
        id1 = generate_jd_id(jd)
        id2 = generate_jd_id(jd)
        assert id1 == id2

    def test_generate_jd_id_differs_for_different_jds(self):
        from services.embeddings import generate_jd_id
        from models.schemas import JobDescription

        jd1 = JobDescription(raw_text="Python developer role at Acme", title="Dev")
        jd2 = JobDescription(raw_text="Java developer role at Beta Corp", title="Dev")
        assert generate_jd_id(jd1) != generate_jd_id(jd2)

    def test_chunk_job_description_includes_skills_and_responsibilities(self):
        from services.embeddings import chunk_job_description
        from models.schemas import JobDescription

        jd = JobDescription(
            raw_text="We need an ML engineer.",
            title="ML Engineer",
            company="Acme",
            required_skills=["Python", "PyTorch"],
            responsibilities=["Train models", "Deploy to production"]
        )
        chunks = chunk_job_description(jd)
        sources = [c["metadata"]["source"] for c in chunks]
        assert "required_skill" in sources
        assert "responsibility" in sources
        assert "full_text" in sources


# Schemas Tests 

class TestSchemas:
    """Test Pydantic schema validation."""

    def test_section_score_validates_range(self):
        from models.schemas import SectionScore

        with pytest.raises(Exception):
            SectionScore(section="Skills", score=150, explanation="too high",
                         top_matches=[], top_gaps=[])

    def test_section_score_valid(self):
        from models.schemas import SectionScore

        s = SectionScore(section="Skills", score=75, explanation="Good match",
                         top_matches=["python"], top_gaps=["kubernetes"])
        assert s.score == 75

    def test_analysis_result_has_required_fields(self):
        from models.schemas import (
            AnalysisResult, AnalysisStatus, ParsedResume, JobDescription,
            MatchScore, GapAnalysis, BulletRewrites, InputFormat
        )

        resume = ParsedResume(
            raw_text="test", sections=[], skills=[], format=InputFormat.TEXT, word_count=1
        )
        jd = JobDescription(raw_text="test role")
        match_score = MatchScore(overall=70, sections=[], verdict="Partial Match", summary="ok")
        gap = GapAnalysis(missing_skills=[], present_skills=[], transferable_skills=[], critical_gaps_count=0)
        rewrites = BulletRewrites(rewrites=[], total_bullets=0, sections_covered=[])

        result = AnalysisResult(
            analysis_id="test-123",
            status=AnalysisStatus.COMPLETE,
            resume=resume, job=jd, match_score=match_score,
            gap_analysis=gap, bullet_rewrites=rewrites,
            created_at="2026-01-01T00:00:00Z",
            processing_time_ms=1234
        )
        assert result.analysis_id == "test-123"
        assert result.match_score.overall == 70


#  API Endpoint Tests 

class TestAnalyzeEndpoint:
    """Test /analyze endpoints with mocked services."""

    @pytest.fixture
    def client(self):
        import os
        os.environ["GROQ_API_KEY"] = "test-key-not-real"
        from main import app
        return TestClient(app, raise_server_exceptions=False)

    def test_health_endpoint_returns_ok(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"

    def test_root_endpoint_returns_name(self, client):
        response = client.get("/")
        assert response.status_code == 200
        assert "ResuMatch" in response.json()["name"]

    def test_analyze_text_missing_job_returns_422(self, client):
        response = client.post("/analyze/text", json={
            "resume_text": "John Doe ML Engineer with Python experience"
        })
        assert response.status_code == 422

    def test_analyze_text_short_resume_returns_422(self, client):
        with patch("routers.analyze.parse_resume", side_effect=ValueError("too short")):
            response = client.post("/analyze/text", json={
                "resume_text": "hi",
                "job_description_text": "we need a python developer"
            })
        assert response.status_code == 422

    def test_scrape_endpoint_invalid_url_returns_error(self, client):
        response = client.post("/scrape", json={"url": "not-a-url"})
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False

    def test_analyze_nonexistent_id_returns_404(self, client):
        response = client.get("/analyze/nonexistent-id-xyz")
        assert response.status_code == 404

    def test_export_nonexistent_id_returns_404(self, client):
        response = client.get("/export/nonexistent-id-xyz/docx")
        assert response.status_code == 404


#  Export Tests 

class TestExport:
    """Test Word redline document generation."""

    def test_generate_redline_docx_returns_bytes(self):
        from services.export import generate_redline_docx
        from models.schemas import (
            AnalysisResult, AnalysisStatus, ParsedResume, JobDescription,
            MatchScore, SectionScore, GapAnalysis, SkillGap,
            BulletRewrites, BulletRewrite, InputFormat
        )

        resume = ParsedResume(
            raw_text="ML Engineer with Python and PyTorch experience",
            sections=[], skills=["python", "pytorch"],
            format=InputFormat.TEXT, word_count=8
        )
        jd = JobDescription(
            raw_text="We need a Python ML Engineer",
            title="ML Engineer", company="Acme Corp",
            required_skills=["Python", "Kubernetes"],
            responsibilities=["Train models", "Deploy systems"]
        )
        match_score = MatchScore(
            overall=65, verdict="Partial Match", summary="Good Python skills, missing Kubernetes.",
            sections=[SectionScore(section="Skills", score=65, explanation="Partial match",
                                   top_matches=["python"], top_gaps=["kubernetes"])]
        )
        gap = GapAnalysis(
            missing_skills=[SkillGap(skill="Kubernetes", priority="critical",
                                     frequency=4, context="Core requirement",
                                     suggestion="Take a Kubernetes course")],
            present_skills=["python"], transferable_skills=[], critical_gaps_count=1
        )
        rewrites = BulletRewrites(
            rewrites=[BulletRewrite(
                original="Worked on machine learning models",
                rewritten="Designed and deployed production ML pipelines using Python and PyTorch",
                keywords_added=["production", "pipelines"],
                explanation="More specific and uses JD keywords",
                section="Experience"
            )],
            total_bullets=1, sections_covered=["Experience"]
        )

        result = AnalysisResult(
            analysis_id="test-export-123",
            status=AnalysisStatus.COMPLETE,
            resume=resume, job=jd, match_score=match_score,
            gap_analysis=gap, bullet_rewrites=rewrites,
            created_at="2026-01-01T00:00:00Z",
            processing_time_ms=5000
        )

        docx_bytes = generate_redline_docx(result)
        assert isinstance(docx_bytes, bytes)
        assert len(docx_bytes) > 1000

    def test_docx_bytes_are_valid_zip(self):
        """DOCX files are ZIP archives — validate the magic bytes."""
        from services.export import generate_redline_docx
        from models.schemas import (
            AnalysisResult, AnalysisStatus, ParsedResume, JobDescription,
            MatchScore, GapAnalysis, BulletRewrites, InputFormat
        )
        import zipfile

        resume = ParsedResume(raw_text="Engineer", sections=[], skills=[],
                              format=InputFormat.TEXT, word_count=1)
        jd = JobDescription(raw_text="Role description here")
        ms = MatchScore(overall=50, sections=[], verdict="Partial Match", summary="ok")
        ga = GapAnalysis(missing_skills=[], present_skills=[], transferable_skills=[], critical_gaps_count=0)
        br = BulletRewrites(rewrites=[], total_bullets=0, sections_covered=[])
        result = AnalysisResult(
            analysis_id="zip-test", status=AnalysisStatus.COMPLETE,
            resume=resume, job=jd, match_score=ms, gap_analysis=ga, bullet_rewrites=br,
            created_at="2026-01-01T00:00:00Z", processing_time_ms=100
        )

        docx_bytes = generate_redline_docx(result)
        assert zipfile.is_zipfile(io.BytesIO(docx_bytes))


#  ATS Density Logic Tests 
class TestAtsDensity:
    """Test the ATS keyword density calculation logic (mirrors frontend logic)."""

    NOISE_WORDS = {
        "the","and","for","are","with","you","will","have","this","that","from",
        "your","our","their","team","role","work","able","also","more","been",
        "they","about","into","which","when","what","such","other","these","those",
        "some","each","only","than","then","well","both","very","just","over",
        "required","preferred","experience","years","strong","skills","ability",
    }

    def _compute_density(self, resume_text: str, jd_text: str) -> float:
        import re
        resume_lower = resume_text.lower()
        jd_lower = jd_text.lower()
        words = list(set(re.split(r'\W+', jd_lower)))
        jd_words = [w for w in words if len(w) > 3 and w not in self.NOISE_WORDS]
        if not jd_words:
            return 0.0
        found = [w for w in jd_words if w in resume_lower]
        return round((len(found) / len(jd_words)) * 100)

    def test_perfect_match_scores_100(self):
        jd = "kubernetes docker python fastapi deployment"
        resume = "kubernetes docker python fastapi deployment"
        density = self._compute_density(resume, jd)
        assert density == 100

    def test_no_match_scores_zero(self):
        jd = "kubernetes terraform gitops"
        resume = "cooking baking gardening"
        density = self._compute_density(resume, jd)
        assert density == 0

    def test_partial_match_scores_between(self):
        jd = "python docker kubernetes terraform fastapi"
        resume = "python docker fastapi"
        density = self._compute_density(resume, jd)
        assert 0 < density < 100

    def test_noise_words_excluded(self):
        jd = "the and with your experience"
        resume = "completely different content here"
        density = self._compute_density(resume, jd)
        # Noise words filtered — should be 0 or very low
        assert density == 0

    def test_case_insensitive(self):
        jd = "Kubernetes Docker Python"
        resume = "kubernetes docker python"
        density = self._compute_density(resume, jd)
        assert density == 100