import json
import asyncio
from openai import AsyncOpenAI
from models.schemas import ParsedResume, JobDescription, MatchScore, SectionScore, GapAnalysis, SkillGap, BulletRewrites, BulletRewrite
from services.embeddings import retrieve_for_section, retrieve_for_bullet


def format_rag_context(chunks: list[dict]) -> str:
    if not chunks:
        return "No specific context retrieved."
    lines = []
    for i, chunk in enumerate(chunks, 1):
        lines.append(f"[Context {i} | source: {chunk['metadata'].get('source','text')} | relevance: {chunk.get('relevance_score',0):.2f}]\n{chunk['text']}")
    return "\n\n".join(lines)


async def call_gpt(client: AsyncOpenAI, system_prompt: str, user_prompt: str, temperature: float = 0.3) -> dict:
    response = await client.chat.completions.create(
        model="gpt-4o",
        temperature=temperature,
        response_format={"type": "json_object"},
        messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}]
    )
    return json.loads(response.choices[0].message.content)


SCORER_SYSTEM = """You are an expert technical recruiter. Score how well a resume matches a job description.
Return JSON: {"overall": int, "verdict": "Strong Match|Partial Match|Weak Match", "summary": str, "sections": [{"section": str, "score": int, "explanation": str, "top_matches": [str], "top_gaps": [str]}]}"""

GAP_SYSTEM = """You are an expert career coach. Identify skill gaps between a resume and job description.
Return JSON: {"missing_skills": [{"skill": str, "priority": "critical|important|nice-to-have", "frequency": int, "context": str, "suggestion": str}], "present_skills": [str], "transferable_skills": [str], "critical_gaps_count": int}"""

REWRITER_SYSTEM = """You are an expert resume writer. Rewrite resume bullets to better match a job description. Keep experience truthful.
Return JSON: {"rewrites": [{"original": str, "rewritten": str, "keywords_added": [str], "explanation": str, "section": str}]}"""


async def run_scorer_chain(resume: ParsedResume, jd: JobDescription, jd_id: str, openai_client: AsyncOpenAI) -> MatchScore:
    section_blocks = []
    for section in resume.sections[:6]:
        chunks = await retrieve_for_section(section, jd_id, openai_client)
        section_blocks.append(f"=== {section.title} ===\n{section.content[:600]}\n\n--- RAG CONTEXT ---\n{format_rag_context(chunks)}")

    user_prompt = f"JOB: {jd.title} at {jd.company}\n\nJD:\n{jd.raw_text[:1000]}\n\nREQUIRED SKILLS: {', '.join(jd.required_skills)}\n\nRESUME SECTIONS:\n{chr(10).join(section_blocks)}\n\nCANDIDATE SKILLS: {', '.join(resume.skills)}"
    result = await call_gpt(openai_client, SCORER_SYSTEM, user_prompt)
    sections = [SectionScore(section=s["section"], score=s["score"], explanation=s["explanation"], top_matches=s.get("top_matches", []), top_gaps=s.get("top_gaps", [])) for s in result.get("sections", [])]
    return MatchScore(overall=result["overall"], sections=sections, verdict=result["verdict"], summary=result["summary"])


async def run_gap_analysis_chain(resume: ParsedResume, jd: JobDescription, jd_id: str, openai_client: AsyncOpenAI) -> GapAnalysis:
    chunks = await retrieve_for_section(resume.sections[0] if resume.sections else type('obj', (object,), {'content': resume.raw_text[:300], 'title': 'Overview'})(), jd_id, openai_client)
    user_prompt = f"JOB: {jd.title} at {jd.company}\n\nFULL JD:\n{jd.raw_text[:2000]}\n\nREQUIRED:\n{chr(10).join(f'- {s}' for s in jd.required_skills)}\n\nRESPONSIBILITIES:\n{chr(10).join(f'- {r}' for r in jd.responsibilities[:8])}\n\nRESUME:\n{resume.raw_text[:1500]}\n\nCANDIDATE SKILLS: {', '.join(resume.skills)}\n\nRAG CONTEXT:\n{format_rag_context(chunks)}"
    result = await call_gpt(openai_client, GAP_SYSTEM, user_prompt)
    missing = [SkillGap(skill=s["skill"], priority=s["priority"], frequency=s.get("frequency", 1), context=s["context"], suggestion=s["suggestion"]) for s in result.get("missing_skills", [])]
    return GapAnalysis(missing_skills=missing, present_skills=result.get("present_skills", []), transferable_skills=result.get("transferable_skills", []), critical_gaps_count=result.get("critical_gaps_count", 0))


async def rewrite_single_bullet(bullet: str, section_name: str, jd: JobDescription, jd_id: str, openai_client: AsyncOpenAI) -> BulletRewrite:
    chunks = await retrieve_for_bullet(bullet, jd_id, openai_client)
    user_prompt = f"JOB: {jd.title} at {jd.company}\n\nBULLET (from {section_name}):\n{bullet}\n\nRAG CONTEXT:\n{format_rag_context(chunks)}\n\nREQUIRED SKILLS: {', '.join(jd.required_skills[:10])}\n\nRewrite this bullet. Return JSON with single item in 'rewrites' array."
    result = await call_gpt(openai_client, REWRITER_SYSTEM, user_prompt, temperature=0.4)
    rewrites = result.get("rewrites", [])
    if rewrites:
        r = rewrites[0]
        return BulletRewrite(original=bullet, rewritten=r.get("rewritten", bullet), keywords_added=r.get("keywords_added", []), explanation=r.get("explanation", ""), section=section_name)
    return BulletRewrite(original=bullet, rewritten=bullet, keywords_added=[], explanation="Could not generate rewrite", section=section_name)


async def run_bullet_rewriter_chain(resume: ParsedResume, jd: JobDescription, jd_id: str, openai_client: AsyncOpenAI, max_bullets: int = 12) -> BulletRewrites:
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
    tasks = [rewrite_single_bullet(bullet, section, jd, jd_id, openai_client) for bullet, section in bullet_section_pairs]
    rewrites = await asyncio.gather(*tasks, return_exceptions=True)
    valid = [r for r in rewrites if isinstance(r, BulletRewrite)]
    return BulletRewrites(rewrites=valid, total_bullets=len(valid), sections_covered=list(sections_covered))


async def run_all_chains(resume: ParsedResume, jd: JobDescription, jd_id: str, openai_client: AsyncOpenAI):
    return await asyncio.gather(
        run_scorer_chain(resume, jd, jd_id, openai_client),
        run_gap_analysis_chain(resume, jd, jd_id, openai_client),
        run_bullet_rewriter_chain(resume, jd, jd_id, openai_client),
    )
