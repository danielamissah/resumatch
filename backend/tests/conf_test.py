"""
Shared pytest fixtures for ResuMatch backend tests.
"""

import os
import pytest
from unittest.mock import MagicMock, AsyncMock


# Set test environment variables before any imports
os.environ.setdefault("GROQ_API_KEY", "test-key-not-real")
os.environ.setdefault("CHROMA_PERSIST_DIR", "/tmp/test_chroma_db")


@pytest.fixture
def sample_resume_text() -> str:
    return """Daniel Kwame Amissah
ML Research Engineer

SUMMARY
ML Research Engineer with published research in computer vision and healthcare ML.
Experienced in building production AI systems and full-stack web applications.

EXPERIENCE
Research Engineer — Data Intelligence Lab, 2023–Present
- Designed and deployed LSTM Autoencoder on AWS SageMaker for anomaly detection
- Built multi-agent cybersecurity research assistant using LangGraph and LangChain
- Developed RAG pipeline over 389 arXiv papers achieving 87% retrieval accuracy

Full Stack Developer — Freelance, 2022–2023
- Built Shitonova food delivery platform using Next.js, PostgreSQL, and Stripe
- Implemented real-time order tracking with WebSockets

SKILLS
Python, PyTorch, TensorFlow, scikit-learn, LangChain, LangGraph, FastAPI
Next.js, React, TypeScript, PostgreSQL, Docker, AWS, SageMaker

PUBLICATIONS
- Vision Transformer for age-invariant face recognition (Wiley, 2024)
- DMA-WOA optimisation for PCOS diagnosis (Springer, 2024)

EDUCATION
BSc Computer Science — University of Ghana, 2023
"""


@pytest.fixture
def sample_jd_text() -> str:
    return """ML Engineer — Aleph Alpha, Heidelberg

We are looking for an ML Engineer to join our applied research team.

About the role:
You will work on deploying large language models to production, building
RAG pipelines, and collaborating with research scientists.

Requirements:
- 3+ years of Python and PyTorch experience
- Strong knowledge of transformer architectures and LLMs
- Experience with RAG systems and vector databases
- Production ML deployment (Docker, Kubernetes, AWS or Azure)
- Familiarity with LangChain or similar frameworks
- Strong problem-solving and communication skills

Responsibilities:
- Design and implement RAG pipelines for enterprise customers
- Deploy and monitor ML models in production environments
- Collaborate with research scientists to productionise models
- Build evaluation frameworks for LLM outputs

Nice to have:
- Published research or open-source contributions
- Experience with MLflow or similar experiment tracking
- Knowledge of German language
"""


@pytest.fixture
def mock_groq_client():
    client = AsyncMock()
    mock_response = MagicMock()
    mock_response.choices[0].message.content = json.dumps({
        "overall": 78,
        "verdict": "Strong Match",
        "summary": "Strong candidate with relevant ML and RAG experience.",
        "sections": [
            {
                "section": "Experience",
                "score": 80,
                "explanation": "Good match on RAG and deployment experience.",
                "top_matches": ["python", "pytorch", "rag"],
                "top_gaps": ["kubernetes"]
            }
        ]
    })
    client.chat.completions.create = AsyncMock(return_value=mock_response)
    return client


import json