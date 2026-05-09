"""
Embeddings Service
------------------
Uses sentence-transformers (local, free) instead of OpenAI embeddings.
ChromaDB handles embedding automatically via the SentenceTransformer
embedding function — no manual embed calls needed.
"""

import hashlib
import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions

from models.schemas import JobDescription, ResumeSection

CHROMA_PERSIST_DIR = "./chroma_db"
COLLECTION_NAME = "job_descriptions"
CHUNK_SIZE = 200
CHUNK_OVERLAP = 40
TOP_K = 5

# Downloads once on first run (~90MB), cached locally after
EMBEDDING_MODEL = "all-MiniLM-L6-v2"


def get_embedding_function():
    return embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=EMBEDDING_MODEL
    )


def get_chroma_client() -> chromadb.PersistentClient:
    return chromadb.PersistentClient(
        path=CHROMA_PERSIST_DIR,
        settings=Settings(anonymized_telemetry=False)
    )


def get_or_create_collection(client: chromadb.PersistentClient) -> chromadb.Collection:
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=get_embedding_function(),
        metadata={"hnsw:space": "cosine"}
    )


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    words = text.split()
    if len(words) <= chunk_size:
        return [text]
    chunks = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunks.append(" ".join(words[start:end]))
        if end == len(words):
            break
        start += chunk_size - overlap
    return chunks


def chunk_job_description(jd: JobDescription) -> list[dict]:
    chunks = []
    for i, chunk in enumerate(chunk_text(jd.raw_text)):
        chunks.append({
            "text": chunk,
            "metadata": {
                "source": "full_text", "chunk_index": i,
                "job_title": jd.title or "unknown",
                "company": jd.company or "unknown",
                "source_url": jd.source_url or "",
            }
        })
    for skill in jd.required_skills:
        chunks.append({
            "text": f"Required skill: {skill}",
            "metadata": {"source": "required_skill", "chunk_index": -1, "job_title": jd.title or "unknown", "company": jd.company or "unknown", "source_url": jd.source_url or ""}
        })
    for resp in jd.responsibilities:
        chunks.append({
            "text": f"Responsibility: {resp}",
            "metadata": {"source": "responsibility", "chunk_index": -1, "job_title": jd.title or "unknown", "company": jd.company or "unknown", "source_url": jd.source_url or ""}
        })
    return chunks


def generate_jd_id(jd: JobDescription) -> str:
    content = (jd.source_url or "") + jd.raw_text[:500]
    return hashlib.md5(content.encode()).hexdigest()


def embed_and_store_jd(jd: JobDescription) -> str:
    """
    Embed and store JD chunks in ChromaDB.
    Now synchronous — sentence-transformers runs locally, no API call.
    Returns jd_id for retrieval.
    """
    jd_id = generate_jd_id(jd)
    chunks = chunk_job_description(jd)
    texts = [c["text"] for c in chunks]
    ids = [f"{jd_id}_{i}" for i in range(len(chunks))]
    metadatas = [{**c["metadata"], "jd_id": jd_id} for c in chunks]

    client = get_chroma_client()
    collection = get_or_create_collection(client)
    # ChromaDB calls the embedding function automatically
    collection.upsert(ids=ids, documents=texts, metadatas=metadatas)
    return jd_id


def retrieve_relevant_chunks(query: str, jd_id: str, top_k: int = TOP_K) -> list[dict]:
    """
    Retrieve top-k relevant JD chunks for a query.
    Synchronous — ChromaDB embeds the query locally.
    """
    client = get_chroma_client()
    collection = get_or_create_collection(client)

    count = collection.count()
    if count == 0:
        return []

    results = collection.query(
        query_texts=[query],
        n_results=min(top_k, count),
        where={"jd_id": jd_id},
        include=["documents", "metadatas", "distances"]
    )

    chunks = []
    if results["documents"] and results["documents"][0]:
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0]
        ):
            chunks.append({
                "text": doc,
                "metadata": meta,
                "relevance_score": round(1 - dist, 4)
            })
    return chunks


def retrieve_for_section(section: ResumeSection, jd_id: str) -> list[dict]:
    return retrieve_relevant_chunks(section.content[:500], jd_id)


def retrieve_for_bullet(bullet: str, jd_id: str) -> list[dict]:
    return retrieve_relevant_chunks(bullet, jd_id, top_k=3)