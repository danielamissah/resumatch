"""
Analysis Chains
---------------
Uses Groq (free) instead of OpenAI for generation.
Embeddings are handled by sentence-transformers (local, free).
All chains are now synchronous for embeddings, async for Groq calls.
"""

import json
import asyncio
from groq import AsyncGroq

from models.schemas import (
    ParsedResume, JobDescription,
    MatchScore, SectionScore,
    GapAnalysis, SkillGap,
    BulletRewrites, BulletRewrite,
)
from services.embeddings import retrieve_for_section, retrieve_for_bullet

MODEL = "llama-3.3-70b-versatile"


def format_rag_context(chunks: list[dict]) -> str:
    if not chunks:
        return "No specific context retrieved."
    lines = []
    for i, chunk in enumerate(chunks, 1):
        source = chunk["metadata"].get("source", "text")
        score = chunk.get("relevance_score", 0)
        lines.append(f"[Context {i} | source: {source} | relevance: {score:.2f}]\n{chunk['text']}")
    return "\n\n".join(lines)


async def call_groq(client: AsyncGroq, system_prompt: str, user_prompt: str, temperature: float = 0.3, retries: int = 3) -> dict:
    for attempt in range(retries):
        try:
            response = await client.chat.completions.create(
                model=MODEL,
                temperature=temperature,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ]
            )
            return json.loads(response.choices[0].message.content)
        except RateLimitError:
            if attempt < retries - 1:
                wait = 5 * (attempt + 1)  # 5s, 10s, 15s
                print(f"Rate limit hit, waiting {wait}s before retry {attempt + 1}...")
                await asyncio.sleep(wait)
            else:
                raise RuntimeError("Groq API rate limit exceeded after multiple retries.")
        except Exception as e:
            raise RuntimeError(f"Error calling Groq API: {e}")


#  Chain 1: Match Scorer 

SCORER_SYSTEM = """You are an expert technical recruiter. Score how well a resume matches a job description.
Return ONLY a JSON object with this exact structure:
{
  "overall": <integer 0-100>,
  "verdict": "<Strong Match | Partial Match | Weak Match>",
  "summary": "<2-3 sentence plain English summary>",
  "sections": [
    {
      "section": "<section name>",
      "score": <integer 0-100>,
      "explanation": "<1-2 sentence explanation>",
      "top_matches": ["<keyword>"],
      "top_gaps": ["<keyword>"]
    }
  ]
}"""


async def run_scorer_chain(resume: ParsedResume, jd: JobDescription, jd_id: str, client: AsyncGroq) -> MatchScore:
    section_blocks = []
    for section in resume.sections[:6]:
        chunks = retrieve_for_section(section, jd_id)
        section_blocks.append(
            f"=== {section.title} ===\n{section.content[:300]}\n\n"
            f"--- RELEVANT JD CONTEXT ---\n{format_rag_context(chunks)}"
        )

    user_prompt = f"""JOB: {jd.title} at {jd.company}
JD SUMMARY: {jd.raw_text[:600]}
REQUIRED SKILLS: {', '.join(jd.required_skills)}
CANDIDATE SKILLS: {', '.join(resume.skills)}

RESUME SECTIONS WITH RAG CONTEXT:
{chr(10).join(section_blocks)}

Score this resume against this job."""

    result = await call_groq(client, SCORER_SYSTEM, user_prompt)
    sections = [
        SectionScore(
            section=s["section"], score=s["score"],
            explanation=s["explanation"],
            top_matches=s.get("top_matches", []),
            top_gaps=s.get("top_gaps", [])
        )
        for s in result.get("sections", [])
    ]
    return MatchScore(
        overall=result["overall"], sections=sections,
        verdict=result["verdict"], summary=result["summary"]
    )


#  Chain 2: Gap Analyser 

GAP_SYSTEM = """You are an expert career coach. Identify skill gaps between a resume and a job description.
Return ONLY a JSON object with this exact structure:
{
  "missing_skills": [
    {
      "skill": "<skill>",
      "priority": "<critical | important | nice-to-have>",
      "frequency": <integer>,
      "context": "<why this matters for this specific role>",
      "suggestion": "<concrete advice to address this gap>"
    }
  ],
  "present_skills": ["<skill>"],
  "transferable_skills": ["<skill>"],
  "critical_gaps_count": <integer>
}"""


async def run_gap_analysis_chain(resume: ParsedResume, jd: JobDescription, jd_id: str, client: AsyncGroq) -> GapAnalysis:
    overview_section = resume.sections[0] if resume.sections else type(
        'obj', (object,), {'content': resume.raw_text[:300], 'title': 'Overview'}
    )()
    chunks = retrieve_for_section(overview_section, jd_id)

    user_prompt = f"""JOB: {jd.title} at {jd.company}
FULL JD: {jd.raw_text[:2000]}
REQUIRED SKILLS: {chr(10).join(f'- {s}' for s in jd.required_skills)}
RESPONSIBILITIES: {chr(10).join(f'- {r}' for r in jd.responsibilities[:8])}
CANDIDATE RESUME: {resume.raw_text[:800]}
CANDIDATE SKILLS: {', '.join(resume.skills)}
RAG CONTEXT: {format_rag_context(chunks)}

Identify what this candidate is missing for this specific role."""

    result = await call_groq(client, GAP_SYSTEM, user_prompt)
    missing = [
        SkillGap(
            skill=s["skill"], priority=s["priority"],
            frequency=s.get("frequency", 1),
            context=s["context"], suggestion=s["suggestion"]
        )
        for s in result.get("missing_skills", [])
    ]
    return GapAnalysis(
        missing_skills=missing,
        present_skills=result.get("present_skills", []),
        transferable_skills=result.get("transferable_skills", []),
        critical_gaps_count=result.get("critical_gaps_count", 0)
    )


#  Chain 3: Bullet Rewriter 

REWRITER_SYSTEM = """You are an expert resume writer. Rewrite resume bullets to better match a job description.
Never invent experience. Incorporate real JD keywords naturally.
Return ONLY a JSON object:
{
  "rewrites": [
    {
      "original": "<original bullet>",
      "rewritten": "<rewritten bullet>",
      "keywords_added": ["<keyword>"],
      "explanation": "<why this rewrite is stronger for this role>",
      "section": "<section name>"
    }
  ]
}"""


async def rewrite_single_bullet(bullet: str, section_name: str, jd: JobDescription, jd_id: str, client: AsyncGroq) -> BulletRewrite:
    chunks = retrieve_for_bullet(bullet, jd_id)
    user_prompt = f"""JOB: {jd.title} at {jd.company}
BULLET (from {section_name}): {bullet}
RELEVANT JD CONTEXT: {format_rag_context(chunks)}
REQUIRED SKILLS: {', '.join(jd.required_skills[:10])}

Rewrite this single bullet. Return JSON with one item in the rewrites array."""

    result = await call_groq(client, REWRITER_SYSTEM, user_prompt, temperature=0.4)
    rewrites = result.get("rewrites", [])
    if rewrites:
        r = rewrites[0]
        return BulletRewrite(
            original=bullet, rewritten=r.get("rewritten", bullet),
            keywords_added=r.get("keywords_added", []),
            explanation=r.get("explanation", ""), section=section_name
        )
    return BulletRewrite(original=bullet, rewritten=bullet, keywords_added=[], explanation="Could not generate rewrite", section=section_name)


async def run_bullet_rewriter_chain(resume: ParsedResume, jd: JobDescription, jd_id: str, client: AsyncGroq, max_bullets: int = 6) -> BulletRewrites:
    bullet_section_pairs = []
    sections_covered = set()
    for section in resume.sections:
        for bullet in section.bullets:
            if len(bullet_section_pairs) >= max_bullets:
                break
            bullet_section_pairs.append((bullet, section.title))
            sections_covered.add(section.title)

    if not bullet_section_pairs:
        return BulletRewrites(rewrites=[], total_bullets=0, sections_covered=[])

    tasks = [rewrite_single_bullet(b, s, jd, jd_id, client) for b, s in bullet_section_pairs]
    rewrites = await asyncio.gather(*tasks, return_exceptions=True)
    valid = [r for r in rewrites if isinstance(r, BulletRewrite)]
    return BulletRewrites(rewrites=valid, total_bullets=len(valid), sections_covered=list(sections_covered))


#  Orchestrator 

async def run_all_chains(resume: ParsedResume, jd: JobDescription, jd_id: str, client: AsyncGroq):
    """Run chains sequentially to stay within Groq free tier TPM limits."""
    match_score = await run_scorer_chain(resume, jd, jd_id, client)
    await asyncio.sleep(3)  # small buffer between chains
    gap_analysis = await run_gap_analysis_chain(resume, jd, jd_id, client)
    await asyncio.sleep(3)
    bullet_rewrites = await run_bullet_rewriter_chain(resume, jd, jd_id, client)
    return match_score, gap_analysis, bullet_rewrites