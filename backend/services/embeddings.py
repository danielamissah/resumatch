import hashlib
from openai import AsyncOpenAI
import chromadb
from chromadb.config import Settings
from models.schemas import JobDescription, ResumeSection

EMBEDDING_MODEL = "text-embedding-3-small"
CHROMA_PERSIST_DIR = "./chroma_db"
COLLECTION_NAME = "job_descriptions"
CHUNK_SIZE = 200
CHUNK_OVERLAP = 40
TOP_K = 5


def get_chroma_client() -> chromadb.PersistentClient:
    return chromadb.PersistentClient(
        path=CHROMA_PERSIST_DIR,
        settings=Settings(anonymized_telemetry=False)
    )


def get_or_create_collection(client: chromadb.PersistentClient) -> chromadb.Collection:
    return client.get_or_create_collection(name=COLLECTION_NAME, metadata={"hnsw:space": "cosine"})


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
        chunks.append({"text": chunk, "metadata": {"source": "full_text", "chunk_index": i, "job_title": jd.title or "unknown", "company": jd.company or "unknown", "source_url": jd.source_url or ""}})
    for skill in jd.required_skills:
        chunks.append({"text": f"Required skill: {skill}", "metadata": {"source": "required_skill", "chunk_index": -1, "job_title": jd.title or "unknown", "company": jd.company or "unknown", "source_url": jd.source_url or ""}})
    for resp in jd.responsibilities:
        chunks.append({"text": f"Responsibility: {resp}", "metadata": {"source": "responsibility", "chunk_index": -1, "job_title": jd.title or "unknown", "company": jd.company or "unknown", "source_url": jd.source_url or ""}})
    return chunks


def generate_jd_id(jd: JobDescription) -> str:
    content = (jd.source_url or "") + jd.raw_text[:500]
    return hashlib.md5(content.encode()).hexdigest()


async def embed_and_store_jd(jd: JobDescription, openai_client: AsyncOpenAI) -> str:
    jd_id = generate_jd_id(jd)
    chunks = chunk_job_description(jd)
    texts = [c["text"] for c in chunks]
    response = await openai_client.embeddings.create(model=EMBEDDING_MODEL, input=texts)
    embeddings = [item.embedding for item in response.data]
    client = get_chroma_client()
    collection = get_or_create_collection(client)
    ids = [f"{jd_id}_{i}" for i in range(len(chunks))]
    metadatas = [{**c["metadata"], "jd_id": jd_id} for c in chunks]
    collection.upsert(ids=ids, embeddings=embeddings, documents=texts, metadatas=metadatas)
    return jd_id


async def retrieve_relevant_chunks(query: str, jd_id: str, openai_client: AsyncOpenAI, top_k: int = TOP_K) -> list[dict]:
    response = await openai_client.embeddings.create(model=EMBEDDING_MODEL, input=[query])
    query_embedding = response.data[0].embedding
    client = get_chroma_client()
    collection = get_or_create_collection(client)
    results = collection.query(query_embeddings=[query_embedding], n_results=min(top_k, collection.count()), where={"jd_id": jd_id}, include=["documents", "metadatas", "distances"])
    chunks = []
    if results["documents"] and results["documents"][0]:
        for doc, meta, dist in zip(results["documents"][0], results["metadatas"][0], results["distances"][0]):
            chunks.append({"text": doc, "metadata": meta, "relevance_score": round(1 - dist, 4)})
    return chunks


async def retrieve_for_section(section: ResumeSection, jd_id: str, openai_client: AsyncOpenAI) -> list[dict]:
    return await retrieve_relevant_chunks(section.content[:500], jd_id, openai_client)


async def retrieve_for_bullet(bullet: str, jd_id: str, openai_client: AsyncOpenAI) -> list[dict]:
    return await retrieve_relevant_chunks(bullet, jd_id, openai_client, top_k=3)
