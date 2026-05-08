import re
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from models.schemas import JobDescription

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
}
REQUEST_TIMEOUT = 15


def detect_platform(url: str) -> str:
    domain = urlparse(url).netloc.lower()
    if "lever.co" in domain: return "lever"
    if "greenhouse.io" in domain: return "greenhouse"
    if "linkedin.com" in domain: return "linkedin"
    return "generic"


def extract_lever(soup: BeautifulSoup) -> dict:
    title = soup.find("h2", class_="posting-headline")
    content = soup.find("div", class_="content")
    return {
        "title": title.get_text(strip=True) if title else "",
        "content": content.get_text(separator="\n", strip=True) if content else "",
    }


def extract_greenhouse(soup: BeautifulSoup) -> dict:
    title = soup.find("h1", class_="app-title")
    content = soup.find("div", id="content")
    return {
        "title": title.get_text(strip=True) if title else "",
        "content": content.get_text(separator="\n", strip=True) if content else "",
    }


def extract_generic(soup: BeautifulSoup) -> dict:
    for tag in soup.find_all(["script", "style", "nav", "header", "footer", "aside"]):
        tag.decompose()

    title = ""
    for selector in ["h1", "h2.job-title", "[class*='job-title']"]:
        el = soup.select_one(selector)
        if el:
            title = el.get_text(strip=True)
            break

    content = ""
    for selector in ["[class*='job-description']", "[class*='description']", "main", "article"]:
        el = soup.select_one(selector)
        if el and len(el.get_text(strip=True)) > 200:
            content = el.get_text(separator="\n", strip=True)
            break

    if not content:
        body = soup.find("body")
        content = body.get_text(separator="\n", strip=True) if body else ""

    return {"title": title, "content": content}


def clean_jd_text(text: str) -> str:
    text = re.sub(r'\r\n', '\n', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()


def extract_company_name(soup: BeautifulSoup, url: str) -> str:
    for meta in soup.find_all("meta"):
        if meta.get("property") in ["og:site_name", "twitter:site"]:
            return meta.get("content", "")
    title_tag = soup.find("title")
    if title_tag:
        parts = re.split(r'\s+[|\-–at]\s+', title_tag.get_text())
        if len(parts) > 1:
            return parts[-1].strip()
    return ""


def extract_required_skills(text: str) -> list[str]:
    skills = []
    req_pattern = re.compile(
        r'(requirements?|must.have|qualifications?)[:\s]+(.*?)(?=\n\n|\Z)',
        re.IGNORECASE | re.DOTALL
    )
    match = req_pattern.search(text)
    if match:
        for line in match.group(2).split('\n'):
            line = re.sub(r'^[•\-–▪*◦→\d\.]\s*', '', line).strip()
            if 10 < len(line) < 200:
                skills.append(line)
    return skills[:15]


def extract_responsibilities(text: str) -> list[str]:
    responsibilities = []
    resp_pattern = re.compile(
        r'(responsibilities|you will|what you.ll do)[:\s]+(.*?)(?=\n\n|\Z)',
        re.IGNORECASE | re.DOTALL
    )
    match = resp_pattern.search(text)
    if match:
        for line in match.group(2).split('\n'):
            line = re.sub(r'^[•\-–▪*◦→\d\.]\s*', '', line).strip()
            if 10 < len(line) < 300:
                responsibilities.append(line)
    return responsibilities[:15]


async def scrape_job_description(url: str) -> JobDescription:
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        raise ValueError(f"Invalid URL: {url}")

    async with httpx.AsyncClient(headers=REQUEST_HEADERS, timeout=REQUEST_TIMEOUT, follow_redirects=True) as client:
        try:
            response = await client.get(url)
            response.raise_for_status()
        except httpx.TimeoutException:
            raise ValueError(f"Request timed out fetching: {url}")
        except httpx.HTTPStatusError as e:
            raise ValueError(f"HTTP {e.response.status_code} fetching: {url}")
        except httpx.RequestError as e:
            raise ValueError(f"Could not reach URL: {url}. Error: {str(e)}")

    soup = BeautifulSoup(response.text, "html.parser")
    platform = detect_platform(url)

    if platform == "lever":
        extracted = extract_lever(soup)
    elif platform == "greenhouse":
        extracted = extract_greenhouse(soup)
    else:
        extracted = extract_generic(soup)

    raw_text = clean_jd_text(extracted.get("content", ""))

    if len(raw_text) < 100:
        raise ValueError("Could not extract meaningful content from this URL. Try pasting the JD directly.")

    return JobDescription(
        raw_text=raw_text,
        title=extracted.get("title", ""),
        company=extract_company_name(soup, url),
        required_skills=extract_required_skills(raw_text),
        preferred_skills=[],
        responsibilities=extract_responsibilities(raw_text),
        source_url=url
    )


def parse_job_description_text(text: str) -> JobDescription:
    cleaned = clean_jd_text(text)
    if len(cleaned) < 50:
        raise ValueError("Job description text is too short to analyse")
    first_line = cleaned.split('\n')[0].strip()
    return JobDescription(
        raw_text=cleaned,
        title=first_line if len(first_line) < 100 else "",
        company="",
        required_skills=extract_required_skills(cleaned),
        preferred_skills=[],
        responsibilities=extract_responsibilities(cleaned),
        source_url=None
    )
